/**
 * EdlPremiumFlow · Parcours EDL Premium glassmorphism bleu électrique (Lot 1).
 *
 * Implémente la séquence stricte 1→26 (cf. edl-premium-sequence.ts) :
 *   1.  Selfie convoyeur (réutilise DriverSelfieCapture)
 *   2-3 Signatures départ (réutilise SignatureCanvas + table mission_signatures)
 *   4-22 Photos EDL + scan documents (table inspection_photos)
 *   23-24 Signatures arrivée
 *   25-26 Envoi admin + validation
 *
 * UX :
 *   - Photo exemple PLEIN ÉCRAN visible AVANT chaque prise photo
 *   - Capture instantanée (capture="environment")
 *   - Compression auto + upload arrière-plan (non bloquant)
 *   - Préchargement de l'image exemple suivante (perf)
 *   - Aucun affichage incohérent : index clampé à STEPS.length
 *   - Reprise via localStorage
 *
 * Backend : aucune migration, réutilise inspection_photos + mission_signatures + mission_selfies.
 */
import { PhotoAnnotationEditor } from "@/components/inspection/PhotoAnnotations";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, ArrowRight, Camera, Check, Loader2, X, RefreshCw,
  ShieldCheck, PenLine, ScanLine, UserCircle2, Sparkles, FileText, MapPin,
  ShieldAlert, FileSearch, Zap, Fuel,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { writeWithOutbox } from "@/lib/offline-outbox";
import { compressImage } from "@/lib/image-compression";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import { toastSignatureError } from "@/lib/signature-upload";
import { DocumentScanner } from "@/components/inspection/DocumentScanner";
import { PlateCheckGate } from "@/components/inspection/PlateCheckGate";
import { isNativeScannerAvailable, scanNativeDocument } from "@/lib/native/document-scanner";


import { useMissionGates } from "@/hooks/useMissionGates";
import { isElectricEnergie, guessElectricFromModel } from "@/lib/vehicule-electrique";
import { RetourBlock } from "@/components/driver2/RetourBlock";
import { PlateBadge } from "@/components/plate/PlateBadge";
import "@/styles/driver-v2.css";
import { logoLigneoSeasonal as logoLigneo } from "@/lib/seasonal-logo";
import {
  EDL_PREMIUM_SEQUENCE,
  ARRIVEE_SIGNATURE_STEPS,
  EDL_RECAP_STEP,
  EDL_TOTAL_STEPS,
  EDL_SECTION_LABEL,
  type EdlStepDef,
} from "./edl-premium-sequence";

interface VehiculeInfo {
  marque?: string | null;
  modele?: string | null;
  immatriculation?: string | null;
  vin?: string | null;
}

interface Props {
  attributionId: string;
  type: "depart" | "arrivee";
  userId: string;
  driverName: string;
  /** Infos véhicule affichées en en-tête et dans le récap final */
  vehicule?: VehiculeInfo;
  /** Pour signatures client : nom à afficher par défaut */
  defaultClientName?: string;
  /** Adresse de livraison : point de départ du bloc « Préparer mon retour » (EDL d'arrivée). */
  livraison?: string;
  onComplete: () => void;
  onClose: () => void;
}

interface StepState {
  status: "idle" | "uploading" | "success" | "error";
  /** Identifiant local de capture pour protéger les uploads arrière-plan contre les reprises. */
  captureId?: string;
  previewUrl?: string;
  storagePath?: string;
  error?: string;
  extras?: Array<{
    id: string;
    previewUrl: string;
    storagePath?: string;
    status: "uploading" | "success" | "error";
    error?: string;
  }>;
  /** OCR uniquement pour kind="scan" */
  ocr?: {
    status: "pending" | "completed" | "failed";
    classification?: "admin" | "client" | "driver";
    fieldsCount?: number;
    error?: string;
  };
  /** Checklist équipements véhicule */
  equipements?: {
    extincteur: boolean;
    kit_securite: boolean;
    cable_charge: boolean;
    tapis_sol: boolean;
    doubles_cles: boolean;
    roue: "secours" | "kit" | "aucun" | null;
  };
  /** Kilométrage saisi */
  kilometrage?: number;
  /** Niveau carburant / batterie saisi (0-100 %) */
  niveau?: number;
}

interface StoredState {
  attributionId: string;
  type: "depart" | "arrivee";
  stepIndex: number;
  states: Record<string, StepState>;
  inspectionId: string | null;
  updatedAt: number;
}

const STORAGE_KEY = (attrId: string, type: "depart" | "arrivee") => `edl-premium:${attrId}:${type}`;

/** Attend que le navigateur revienne en ligne, jusqu'à `timeoutMs`. */
async function waitForOnline(timeoutMs = 30000): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine !== false) return;
  await new Promise<void>((resolve) => {
    const handler = () => { window.removeEventListener("online", handler); resolve(); };
    window.addEventListener("online", handler);
    setTimeout(() => { window.removeEventListener("online", handler); resolve(); }, timeoutMs);
  });
}

/** Upload résilient : backoff exponentiel + attente reconnexion réseau. */
async function uploadWithRetry(
  bucket: string, path: string, file: File, attempts = 6
): Promise<void> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await waitForOnline();
    }
    try {
      const { error } = await supabase.storage.from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (!error) return;
      lastErr = error;
    } catch (e) { lastErr = e; }
    // Backoff exponentiel borné : 500ms, 1s, 2s, 4s, 8s, 8s
    const delay = Math.min(8000, 500 * Math.pow(2, i));
    await new Promise(r => setTimeout(r, delay));
  }
  throw lastErr ?? new Error("Upload échoué");
}

/** Map short signature kind (driver_start, …) → slot doc canonique pour MissionTraceability/admin. */
const SIGNATURE_DOC_KEY: Record<string, string> = {
  driver_start: "pv_signature_depart_convoyeur",
  client_start: "pv_signature_depart_client",
  driver_end: "pv_signature_arrivee_convoyeur",
  client_end: "pv_signature_arrivee_client",
};

async function materializeCapturedFile(raw: File) {
  const buffer = await raw.arrayBuffer();
  const safeType = raw.type && raw.type.startsWith("image/") ? raw.type : "image/jpeg";
  const safeName = raw.name || `capture_${Date.now()}.jpg`;

  return new File([buffer], safeName, {
    type: safeType,
    lastModified: raw.lastModified || Date.now(),
  });
}

async function prepareCapturedImage(raw: File) {
  const stableFile = await materializeCapturedFile(raw);
  const looksLikeImage = stableFile.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(stableFile.name);

  if (!stableFile.size) {
    throw new Error("Image vide. Réessayez.");
  }

  if (!looksLikeImage) {
    throw new Error("Format de photo non reconnu.");
  }

  return stableFile;
}

function revokeBlobUrl(url?: string) {
  if (!url?.startsWith("blob:")) return;
  try { URL.revokeObjectURL(url); } catch { /* ignore */ }
}

function newCaptureId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function EdlPremiumFlow({
  attributionId, type, userId, driverName, defaultClientName, vehicule, livraison,
  onComplete, onClose,
}: Props) {
  // Carburant véhicule (depuis attribution → trajet → demande). Sert à filtrer
  // l'étape "câble électrique" (electricOnly). Si inconnu → étape masquée par sécurité.
  const [vehicleCarburant, setVehicleCarburant] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: attr } = await supabase
          .from("attributions")
          .select("trajet_id")
          .eq("id", attributionId)
          .maybeSingle();
        if (!attr?.trajet_id || cancelled) return;
        const { data: trajRaw } = await supabase
          .from("trajets_assigned_safe" as never)
          .select("demande_id")
          .eq("id", attr.trajet_id)
          .maybeSingle();
        const traj = trajRaw as { demande_id: string | null } | null;
        if (!traj?.demande_id || cancelled) return;
        const { data: dem } = await supabase
          .from("demandes_convoyage")
          .select("carburant, marque, modele")
          .eq("id", traj.demande_id)
          .maybeSingle();
        if (cancelled) return;
        const d = dem as { carburant?: string | null; marque?: string | null; modele?: string | null } | null;
        // Si le champ carburant est vide/inconnu, on retombe sur la détection
        // par marque/modèle (Tesla, Zoé, ID.4, e-208…).
        const detected = isElectricEnergie(d?.carburant)
          || (!d?.carburant && guessElectricFromModel(d?.marque, d?.modele));
        setVehicleCarburant(detected ? "electrique" : (d?.carburant ?? "").toLowerCase());
      } catch { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, [attributionId]);

  // Électrique OU hybride rechargeable (PHEV). Un simple "hybride" (non
  // rechargeable) n'a pas de câble et ne déclenche donc pas l'étape.
  // Fallback marque/modèle depuis les infos véhicule déjà affichées (Tesla, Zoé…)
  // pour ne jamais rater le câble de recharge si le champ carburant est vide.
  const isElectric =
    isElectricEnergie(vehicleCarburant) ||
    guessElectricFromModel(vehicule?.marque, vehicule?.modele);

  const STEPS = useMemo(() => {
    // DÉPART : toutes les étapes EDL sauf le selfie initial (géré par cockpit).
    // ARRIVÉE : mêmes étapes photos + scans + checklist que le départ pour
    //           garantir un dossier de restitution symétrique. Les signatures
    //           d'arrivée restent gérées par ArriveeSignatureSheet (déclenchée
    //           par le cockpit après finalisation de l'EDL arrivée).
    // Étape électrique masquée si véhicule ni électrique ni hybride rechargeable.
    const base = EDL_PREMIUM_SEQUENCE.filter((step) => {
      if (step.kind === "selfie") return false;
      if (type === "arrivee" && step.kind === "signature") return false;
      if (step.electricOnly && !isElectric) return false;
      // Kilométrages restent phase-spécifiques ; la checklist équipements
      // s'affiche aux deux phases (contrôle départ + contrôle restitution).
      if (step.id === "kilometrage_depart" && type !== "depart") return false;
      if (step.id === "kilometrage_arrivee" && type !== "arrivee") return false;
      return true;
    });
    if (type !== "arrivee") return [...base, { ...EDL_RECAP_STEP, phase: "depart" as const }];
    // ARRIVÉE (même ordre que l'appli validée) : tour du véhicule, photos libres,
    // carte grise, PV de livraison, puis les deux signatures juste après le PV,
    // le kilométrage, et le récapitulatif. Le selfie final et l'envoi à l'admin
    // viennent ensuite, depuis la mission.
    const LATE = ["photos_libres_degats", "carte_grise", "pv_livraison"];
    const pick = (id: string) => base.find((x) => x.id === id);
    const tour = base.filter((x) => !LATE.includes(x.id));
    const tail = [
      pick("photos_libres_degats"),
      pick("carte_grise"),
      pick("pv_livraison"),
      ...ARRIVEE_SIGNATURE_STEPS,
      { ...EDL_RECAP_STEP, phase: "arrivee" as const },
    ].filter((x): x is EdlStepDef => Boolean(x));
    return [...tour, ...tail];
  }, [type, isElectric]);
  const TOTAL = STEPS.length;

  // Reprise via localStorage
  const initialState = useMemo<StoredState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY(attributionId, type));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredState;
      return parsed.attributionId === attributionId && parsed.type === type ? parsed : null;
    } catch { return null; }
  }, [attributionId, type]);

  const [stepIndex, setStepIndex] = useState(() => initialState?.stepIndex ?? 0);
  const [states, setStates] = useState<Record<string, StepState>>(
    () => initialState?.states ?? {}
  );
  const [inspectionId, setInspectionId] = useState<string | null>(
    initialState?.inspectionId ?? null
  );



  const [askExit, setAskExit] = useState(false);

  // Vérification de plaque : uniquement AVANT l'EDL de départ. À l'arrivée, le
  // véhicule est déjà identifié, on ne redemande pas de scanner la plaque.
  const PLATE_KEY = `edl-plate-check:${attributionId}:${type}`;
  const [plateChecked, setPlateChecked] = useState<boolean>(() => {
    if (type !== "depart") return true;
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(PLATE_KEY) === "1"; } catch { return false; }
  });
  const markPlateChecked = useCallback(() => {
    try { localStorage.setItem(PLATE_KEY, "1"); } catch { /* ignore */ }
    setPlateChecked(true);
  }, [PLATE_KEY]);


  const [completing, setCompleting] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);
  const [openScanner, setOpenScanner] = useState(false);
  const [signatureClientName, setSignatureClientName] = useState(defaultClientName ?? "");
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydratedRemoteStateRef = useRef(false);

  // Bypass admin (étend useMissionGates aux IDs scan/photo)
  const { isDisabled } = useMissionGates(attributionId);

  // Warm-up caméra : précharge l'API getUserMedia dès l'ouverture pour réduire la latence
  // de la première prise photo (sur mobile, le 1er accès caméra peut prendre 1-2s).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        // Stop immédiat · on n'avait besoin que d'initialiser le pipeline
        stream.getTracks().forEach(t => t.stop());
      } catch { /* permission refusée → silence, le clic ouvrira le dialog */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Clamp pour éviter X/Y incohérent (TOTAL peut être 0 si filtre vide)
  const safeIndex = TOTAL > 0 ? Math.min(Math.max(0, stepIndex), TOTAL - 1) : 0;
  useEffect(() => {
    if (TOTAL > 0 && stepIndex !== safeIndex) setStepIndex(safeIndex);
  }, [stepIndex, safeIndex, TOTAL]);

  const currentStep = STEPS[safeIndex];
  const currentState = currentStep ? states[currentStep.id] : undefined;
  const completed = STEPS.filter(s => (s.id === "edl_recap" ? safeIndex === TOTAL - 1 : states[s.id]?.status === "success")).length;
  const progressPct = TOTAL > 0 ? Math.round((completed / TOTAL) * 100) : 0;

  // === Persistence
  useEffect(() => {
    const safeStates = Object.fromEntries(
      Object.entries(states)
        .filter(([, v]) => v.status === "success")
        .map(([k, v]) => [k, { ...v, previewUrl: v.previewUrl?.startsWith("blob:") ? undefined : v.previewUrl }])
    );
    const data: StoredState = {
      attributionId,
      type,
      stepIndex,
      states: safeStates as Record<string, StepState>,
      inspectionId,
      updatedAt: Date.now(),
    };
    try { localStorage.setItem(STORAGE_KEY(attributionId, type), JSON.stringify(data)); } catch { /* ignore */ }
  }, [attributionId, inspectionId, states, stepIndex, type]);

  useEffect(() => {
    if (hydratedRemoteStateRef.current) return;

    let cancelled = false;

    const hydrateRemoteProgress = async () => {
      try {
        const { data: existingInspection, error: inspErr } = await supabase
          .from("inspections")
          .select("id")
          .eq("attribution_id", attributionId)
          .eq("type", type)
          .maybeSingle();

        if (inspErr) console.warn("[EDL hydrate] inspections lookup failed", inspErr);

        if (!existingInspection?.id || cancelled) {
          hydratedRemoteStateRef.current = true;
          return;
        }

        setInspectionId(existingInspection.id);

        const [photoRes, signatureRes, selfieRes] = await Promise.all([
          supabase
            .from("inspection_photos")
            .select("vue_type, url_photo")
            .eq("inspection_id", existingInspection.id),
          supabase
            .from("mission_signatures")
            .select("kind")
            .eq("attribution_id", attributionId),
          supabase
            .from("mission_selfies")
            .select("storage_path")
            .eq("attribution_id", attributionId)
            .order("taken_at", { ascending: false })
            .limit(1),
        ]);

        const photoRows = Array.isArray(photoRes?.data) ? photoRes.data : [];
        const signatureRows = Array.isArray(signatureRes?.data) ? signatureRes.data : [];
        const selfieRows = Array.isArray(selfieRes?.data) ? selfieRes.data : [];

        if (cancelled) return;

        const photoPaths = photoRows.map((row) => row?.url_photo).filter(Boolean) as string[];
        const selfiePath = selfieRows[0]?.storage_path ?? null;

        const [photoPreviewEntries, selfiePreviewUrl] = await Promise.all([
          Promise.all(
            photoPaths.map(async (path) => {
              try {
                const { data } = await supabase.storage.from("inspection-photos").createSignedUrl(path, 3600);
                return [path, data?.signedUrl] as const;
              } catch {
                return [path, undefined] as const;
              }
            }),
          ),
          selfiePath
            ? supabase.storage.from("mission-selfies").createSignedUrl(selfiePath, 3600).then(({ data }) => data?.signedUrl ?? undefined).catch(() => undefined)
            : Promise.resolve(undefined),
        ]);

        if (cancelled) return;

        const photoPreviewMap = new Map(photoPreviewEntries);

        setStates((prev) => {
          const next = { ...prev };

          for (const row of photoRows) {
            if (!row?.vue_type) continue;
            if (row.vue_type.startsWith("photos_libres_degats_")) {
              const signedUrl = photoPreviewMap.get(row.url_photo) ?? prev.photos_libres_degats?.previewUrl;
              const extras = next.photos_libres_degats?.extras ?? prev.photos_libres_degats?.extras ?? [];
              next.photos_libres_degats = {
                ...(next.photos_libres_degats ?? prev.photos_libres_degats ?? { status: "success" }),
                status: "success",
                extras: [...extras, {
                  id: row.vue_type,
                  storagePath: row.url_photo,
                  previewUrl: signedUrl ?? row.url_photo,
                  status: "success",
                }],
              };
              continue;
            }
            next[row.vue_type] = {
              status: "success",
              storagePath: row.url_photo,
              previewUrl: photoPreviewMap.get(row.url_photo) ?? prev[row.vue_type]?.previewUrl,
              ocr: prev[row.vue_type]?.ocr,
            };
          }

          for (const row of signatureRows) {
            if (!row?.kind) continue;
            const signatureStep = STEPS.find((step) => step.signatureKind === row.kind);
            if (signatureStep) {
              next[signatureStep.id] = {
                status: "success",
                previewUrl: prev[signatureStep.id]?.previewUrl,
                storagePath: prev[signatureStep.id]?.storagePath,
              };
            }
          }

          if (selfiePath) {
            const selfieStep = STEPS.find((step) => step.kind === "selfie");
            if (selfieStep) {
              next[selfieStep.id] = {
                status: "success",
                storagePath: selfiePath,
                previewUrl: selfiePreviewUrl ?? prev[selfieStep.id]?.previewUrl,
              };
            }
          }

          const firstIncompleteIndex = STEPS.findIndex((step) => next[step.id]?.status !== "success");
          if (firstIncompleteIndex >= 0) {
            setStepIndex((current) => Math.max(current, firstIncompleteIndex));
          }

          return next;
        });
      } catch (e) {
        console.error("[EDL hydrate] non-blocking error", e);
      } finally {
        hydratedRemoteStateRef.current = true;
      }
    };

    void hydrateRemoteProgress();

    return () => {
      cancelled = true;
    };
  }, [STEPS, attributionId, type]);

  const reconcileCurrentPhotoStep = useCallback(async () => {
    if (!currentStep || (currentStep.kind !== "photo" && currentStep.kind !== "scan")) {
      return false;
    }

    if (states[currentStep.id]?.status === "success") {
      return true;
    }

    try {
      let insId = inspectionId;

      if (!insId) {
        const { data: existingInspection } = await supabase
          .from("inspections")
          .select("id")
          .eq("attribution_id", attributionId)
          .eq("type", type)
          .maybeSingle();

        insId = existingInspection?.id ?? null;
        if (!insId) return false;
        setInspectionId(insId);
      }

      const { data: photoRow } = await supabase
        .from("inspection_photos")
        .select("url_photo")
        .eq("inspection_id", insId)
        .eq("vue_type", currentStep.id)
        .maybeSingle();

      if (!photoRow?.url_photo) return false;

      let previewUrl = states[currentStep.id]?.previewUrl;
      try {
        const { data } = await supabase.storage
          .from("inspection-photos")
          .createSignedUrl(photoRow.url_photo, 3600);
        previewUrl = data?.signedUrl ?? previewUrl;
      } catch {
        // Best effort: le status success suffit à réactiver "Photo suivante".
      }

      setStates((prev) => {
        const current = prev[currentStep.id];
        if (
          current?.status === "success" &&
          current.storagePath === photoRow.url_photo &&
          (current.previewUrl || !previewUrl)
        ) {
          return prev;
        }

        return {
          ...prev,
          [currentStep.id]: {
            ...current,
            status: "success",
            storagePath: photoRow.url_photo,
            previewUrl: previewUrl ?? current?.previewUrl,
            ocr: current?.ocr,
          },
        };
      });

      return true;
    } catch (error) {
      console.warn("[EDL reconcile] current photo step sync failed", error);
      return false;
    }
  }, [attributionId, currentStep, inspectionId, states, type]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!currentStep || (currentStep.kind !== "photo" && currentStep.kind !== "scan")) return;

    let cancelled = false;
    let timeoutId: number | null = null;

    const clearTimer = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const pollForCurrentPhoto = () => {
      clearTimer();
      if (states[currentStep.id]?.status === "success") return;

      let attempts = 0;
      const run = async () => {
        if (cancelled || document.visibilityState === "hidden") return;
        attempts += 1;
        const found = await reconcileCurrentPhotoStep();
        if (!found && attempts < 6) {
          timeoutId = window.setTimeout(run, 700);
        }
      };

      void run();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        pollForCurrentPhoto();
      }
    };

    window.addEventListener("focus", pollForCurrentPhoto);
    window.addEventListener("pageshow", pollForCurrentPhoto);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearTimer();
      window.removeEventListener("focus", pollForCurrentPhoto);
      window.removeEventListener("pageshow", pollForCurrentPhoto);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentStep, reconcileCurrentPhotoStep, states]);

  // === Préchargement image exemple suivante (perf)
  useEffect(() => {
    const next = STEPS[safeIndex + 1];
    if (next?.example && typeof window !== "undefined") {
      const img = new Image();
      img.src = next.example;
    }
  }, [safeIndex, STEPS]);

  // === Libération mémoire : révoque les blob: des étapes non actives.
  // Chaque blob retient le File compressé (jusqu'à plusieurs Mo). Sur 20+ photos,
  // sans révocation, on dépasse facilement la limite mémoire mobile (OOM).
  // L'aperçu n'est utile que pour l'étape courante · les autres ont déjà été uploadées.
  useEffect(() => {
    const currentId = STEPS[safeIndex]?.id;
    setStates(prev => {
      let changed = false;
      const next: Record<string, StepState> = {};
      for (const [id, st] of Object.entries(prev)) {
        if (id !== currentId && st?.status === "success" && st.previewUrl?.startsWith("blob:")) {
          revokeBlobUrl(st.previewUrl);
          next[id] = { ...st, previewUrl: undefined };
          changed = true;
        } else {
          next[id] = st;
        }
        // Révoque aussi les blob: des extras non-uploading
        if (st?.extras?.length) {
          const cleanedExtras = st.extras.map(ex => {
            if (id !== currentId && ex.status === "success" && ex.previewUrl?.startsWith("blob:")) {
              revokeBlobUrl(ex.previewUrl);
              changed = true;
              return { ...ex, previewUrl: ex.storagePath ?? "" };
            }
            return ex;
          });
          next[id] = { ...next[id], extras: cleanedExtras };
        }
      }
      return changed ? next : prev;
    });
  }, [safeIndex, STEPS]);

  // === Lock body scroll + cleanup blobs au démontage
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      // Révoque TOUS les blobs restants pour éviter les fuites mémoire
      setStates(current => {
        for (const st of Object.values(current)) {
          revokeBlobUrl(st?.previewUrl);
          st?.extras?.forEach(ex => revokeBlobUrl(ex.previewUrl));
        }
        return current;
      });
    };
  }, []);

  // === Notification reconnexion : prévient l'utilisateur quand des photos sont en erreur
  // et que le réseau revient. L'utilisateur peut alors cliquer "Réessayer l'envoi".
  useEffect(() => {
    const onOnline = () => {
      const errored = Object.values(states).filter(s => s?.status === "error").length;
      if (errored > 0) {
        toast.success("Connexion rétablie", {
          description: `${errored} photo(s) en attente · cliquez "Réessayer l'envoi".`,
        });
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [states]);

  // === Inspection de la phase courante · créée à la première photo nécessaire
  const ensureInspection = useCallback(async () => {
    if (inspectionId) return inspectionId;
    const { data: existing } = await supabase
      .from("inspections")
      .select("id")
      .eq("attribution_id", attributionId)
      .eq("type", type)
      .maybeSingle();
    if (existing?.id) {
      setInspectionId(existing.id);
      return existing.id;
    }
    const { data, error } = await supabase
      .from("inspections")
      .insert({ attribution_id: attributionId, type, statut: "en_cours" })
      .select("id").single();
    if (error) throw error;
    setInspectionId(data.id);
    return data.id;
  }, [attributionId, inspectionId, type]);

  useEffect(() => {
    void ensureInspection().catch(() => {
      // Non bloquant : un retry sera fait au premier upload si nécessaire.
    });
  }, [ensureInspection]);

  // ─────────────────────────── HANDLERS ───────────────────────────
  /** Avance vers l'étape suivante (utilisé après succès photo / scan / signature). */
  const autoAdvance = useCallback(() => {
    setStepIndex((current) => {
      const next = current + 1;
      return next < TOTAL ? next : current;
    });
  }, [TOTAL]);

  const triggerCapture = () => {
    if (currentStep.kind === "scan") {
      // Scanner natif (détection de bords, capture auto/manuelle, flash) quand
      // l'app Driver est utilisée · sinon fallback scanner web existant.
      if (isNativeScannerAvailable()) {
        void (async () => {
          const res = await scanNativeDocument({
            maxPages: 1,
            filename: currentStep.id,
          });
          if (res.status === "success" && res.files[0]) {
            processPhotoFile(res.files[0]);
          } else if (res.status === "error") {
            toast.error("Scanner indisponible", { description: res.message });
            setOpenScanner(true);
          }
        })();
        return;
      }
      setOpenScanner(true);
    } else {
      fileRef.current?.click();
    }
  };


  /** Pour les étapes scan : prendre une simple photo sans recadrage/OCR. */
  const triggerSimpleCapture = () => {
    fileRef.current?.click();
  };

  /** Ignorer une étape scan : marquée comme validée sans document. Non destructif. */
  /** Kit de sécurité absent du véhicule : l'étape photo peut être passée. */
  const markKitAbsent = () => {
    setState(currentStep.id, { status: "success", error: undefined });
    toast.info("Kit de sécurité signalé absent · étape passée");
  };

  const skipCurrentScan = () => {

    const stepId = currentStep.id;
    setState(stepId, { status: "success", ocr: { status: "failed", error: "Ignoré par l'utilisateur" } });
    toast.info("Scan ignoré · appuyez sur \"Photo suivante\" pour continuer");
  };

  const setState = (id: string, s: StepState) =>
    setStates(prev => ({ ...prev, [id]: s }));

  /** Valide l'étape "Équipements véhicule" et persiste la sélection. */
  const validateChecklist = async (equip: NonNullable<StepState["equipements"]>) => {
    const stepId = currentStep.id;
    setState(stepId, { status: "uploading", equipements: equip });
    try {
      const insId = await ensureInspection();
      const { error } = await supabase
        .from("inspections")
        .update({ equipements: equip })
        .eq("id", insId);
      if (error) throw error;
      setState(stepId, { status: "success", equipements: equip });
      toast.success("Équipements enregistrés");
    } catch (err) {
      setState(stepId, { status: "error", equipements: equip, error: err instanceof Error ? err.message : "Erreur" });
      toast.error("Enregistrement impossible", { description: "Réessayez dans quelques secondes." });
    }
  };

  /** Valide l'étape kilométrage + niveau d'énergie, puis lance le contrôle anti-triche (non bloquant). */
  const validateKilometrage = async (value: number, niveau: number) => {
    const stepId = currentStep.id;
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Saisissez un kilométrage valide");
      return;
    }
    setState(stepId, { status: "uploading", kilometrage: value, niveau });
    try {
      const insId = await ensureInspection();
      const arr = stepId === "kilometrage_arrivee";
      const payload = arr
        ? { kilometrage_arrivee: value, niveau_energie_arrivee: niveau }
        : { kilometrage_depart: value, niveau_energie_depart: niveau };
      let { error } = await supabase
        .from("inspections")
        .update(payload as never)
        .eq("id", insId);
      if (error) {
        // Colonne « niveau » pas encore créée côté base : on enregistre au moins le kilométrage.
        const r2 = await supabase
          .from("inspections")
          .update((arr ? { kilometrage_arrivee: value } : { kilometrage_depart: value }) as never)
          .eq("id", insId);
        error = r2.error;
      }
      if (error) throw error;
      setState(stepId, { status: "success", kilometrage: value, niveau });
      toast.success("Kilométrage et niveau enregistrés");
      void supabase.functions.invoke("edl-compteur-read", {
        body: { mode: "verify", inspection_id: insId, attribution_id: attributionId, phase: arr ? "arrivee" : "depart", declared: { km: value, level_pct: niveau } },
      }).catch(() => { /* contrôle non bloquant */ });
    } catch (err) {
      setState(stepId, { status: "error", kilometrage: value, niveau, error: err instanceof Error ? err.message : "Erreur" });
      toast.error("Enregistrement impossible", { description: "Réessayez dans quelques secondes." });
    }
  };

  /** Lecture automatique du compteur sur la photo (aide à la saisie, jamais bloquante). */
  const readCompteur = async (): Promise<{ km: number | null; level_pct: number | null; suspicious: boolean } | null> => {
    try {
      const insId = await ensureInspection();
      const { data, error } = await supabase.functions.invoke("edl-compteur-read", {
        body: { mode: "read", inspection_id: insId, attribution_id: attributionId, phase: type },
      });
      if (error || !data) return null;
      return data as { km: number | null; level_pct: number | null; suspicious: boolean };
    } catch {
      return null;
    }
  };

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;
    // Ne jamais attendre la préparation/upload ici : sur Android, garder le
    // handler ultra-court évite l'écran blanc de reprise Chrome entre 2 photos.
    processPhotoFile(raw);
  };

  const processPhotoFile = (raw: File) => {
    const stepId = currentStep.id;
    const isScan = currentStep.kind === "scan";
    const captureId = newCaptureId();
    let previewUrl: string | undefined;

    // 1) ACTIVATION IMMÉDIATE du bouton "Photo suivante" :
    //    on crée l'aperçu DIRECTEMENT depuis le File brut (synchrone, instantané)
    //    et on met l'étape en "success" AVANT tout await. Cela garantit que le
    //    bouton devient actif dès que la photo est sélectionnée, sans attendre
    //    `prepareCapturedImage` (qui fait un arrayBuffer() pouvant prendre
    //    plusieurs centaines de ms sur mobile pour les gros JPEG/HEIC).
    try {
      previewUrl = URL.createObjectURL(raw);
      setState(stepId, {
        status: "success",
        captureId,
        previewUrl,
        ocr: isScan ? { status: "pending" } : undefined,
      });

      // 2) Upload + persistance en arrière-plan · n'empêche pas l'utilisateur d'avancer.
      void (async () => {
        try {
          // Préparation du fichier stable (peut être lente sur mobile) en arrière-plan.
          const stableFile = await prepareCapturedImage(raw);
          const insId = await ensureInspection();
          let compressed: File;
          try { compressed = await compressImage(stableFile); }
          catch { compressed = stableFile; }
          const path = `${userId}/${insId}/${stepId}.jpg`;
          await uploadWithRetry("inspection-photos", path, compressed);

          // delete-then-insert (plus fiable que upsert sur certaines configs RLS)
          await supabase.from("inspection_photos")
            .delete().eq("inspection_id", insId).eq("vue_type", stepId);

          const { error: insertErr } = await supabase
            .from("inspection_photos")
            .insert({
              inspection_id: insId, vue_type: stepId,
              url_photo: path, file_size_bytes: compressed.size,
            });

          if (insertErr) {
            const { error: upsertErr } = await supabase
              .from("inspection_photos")
              .upsert(
                { inspection_id: insId, vue_type: stepId, url_photo: path, file_size_bytes: compressed.size },
                { onConflict: "inspection_id,vue_type" },
              );
            if (upsertErr) throw upsertErr;
          }

          // Mise à jour avec le storagePath confirmé (status reste success).
          setStates((prev) => {
            const cur = prev[stepId];
            if (!cur || cur.captureId !== captureId) return prev; // étape déjà retaken/supprimée
            return { ...prev, [stepId]: { ...cur, status: "success", storagePath: path } };
          });

          // OCR auto pour scans · non bloquant
          if (isScan) {
            supabase.functions.invoke("edl-document-ocr", {
              body: {
                storage_path: path, document_type: stepId,
                inspection_id: insId, attribution_id: attributionId, vue_type: stepId,
              },
            }).then(({ data, error }) => {
              if (error || !data) {
                setStates(prev => ({
                  ...prev,
                  [stepId]: { ...prev[stepId], ocr: { status: "failed", error: error?.message ?? "OCR indisponible" } },
                }));
                toast.warning("OCR indisponible", { description: "Document enregistré sans extraction." });
                return;
              }
              const fields = Object.entries((data.structured ?? {}) as Record<string, unknown>)
                .filter(([k, v]) => k !== "raw_text" && typeof v === "string" && v).length;
              setStates(prev => ({
                ...prev,
                [stepId]: {
                  ...prev[stepId],
                  ocr: { status: "completed", classification: data.classification, fieldsCount: fields },
                },
              }));
              if (fields > 0) {
                toast.success(`Scan OCR · ${fields} champ(s) extraits`, {
                  description: `Classé : ${data.classification === "admin" ? "Admin" : data.classification === "client" ? "Client" : "Driver"}`,
                });
              }
            }).catch(e => {
              setStates(prev => ({
                ...prev,
                [stepId]: { ...prev[stepId], ocr: { status: "failed", error: String(e) } },
              }));
            });
          }
        } catch (err) {
          console.error("[EDL Premium] background upload failed", err);
          // Rollback : repasse l'étape en erreur si l'aperçu local est toujours actif.
          setStates((prev) => {
            const cur = prev[stepId];
            if (!cur || cur.captureId !== captureId) return prev;
            return {
              ...prev,
              [stepId]: {
                ...cur,
                status: "error",
                error: err instanceof Error ? err.message : "Erreur réseau",
              },
            };
          });
          toast.error("Échec d'envoi", {
            description: err instanceof Error ? err.message : "Réessayez la photo.",
          });
        }
      })();
    } catch (err) {
      // Erreur SYNCHRONE de préparation (fichier invalide, etc.)
      console.error("[EDL Premium] photo preparation failed", err);
      setState(stepId, {
        status: "error", previewUrl,
        error: err instanceof Error ? err.message : "Image invalide",
      });
      toast.error("Photo invalide", {
        description: err instanceof Error ? err.message : "Réessayez la photo.",
      });
    }
  };


  const handleExtraPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;

    const stepId = currentStep.id;
    const extraId = crypto.randomUUID();
    // Preview INSTANTANÉ depuis le fichier brut · pas d'await avant l'affichage.
    const previewUrl = URL.createObjectURL(raw);
    setStates((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] ?? { status: "idle" as const }),
        status: "success",
        extras: [
          ...((prev[stepId]?.extras ?? []).filter(Boolean)),
          { id: extraId, previewUrl, status: "uploading" as const },
        ],
      },
    }));

    // Upload + persistance en arrière-plan · n'empêche pas l'utilisateur d'avancer
    // ni d'ajouter d'autres photos (uploads parallèles possibles).
    void (async () => {
      try {
        const stableFile = await prepareCapturedImage(raw);
        const insId = await ensureInspection();
        const compressed = await compressImage(stableFile).catch(() => stableFile);
        const path = `${userId}/${insId}/${stepId}_${Date.now()}.jpg`;
        await uploadWithRetry("inspection-photos", path, compressed);

        const { error } = await supabase.from("inspection_photos").insert({
          inspection_id: insId,
          vue_type: `${stepId}_${Date.now()}`,
          url_photo: path,
          file_size_bytes: compressed.size,
        });
        if (error) throw error;

        setStates((prev) => ({
          ...prev,
          [stepId]: {
            ...(prev[stepId] ?? { status: "idle" as const }),
            status: "success",
            extras: (prev[stepId]?.extras ?? []).map((item) =>
              item.id === extraId ? { ...item, storagePath: path, status: "success" as const } : item,
            ),
          },
        }));
      } catch (err) {
        setStates((prev) => ({
          ...prev,
          [stepId]: {
            ...(prev[stepId] ?? { status: "idle" as const }),
            status: "success",
            extras: (prev[stepId]?.extras ?? []).map((item) =>
              item.id === extraId
                ? {
                    ...item,
                    status: "error" as const,
                    error: err instanceof Error ? err.message : "Erreur d'envoi",
                  }
                : item,
            ),
          },
        }));
        toast.error("Impossible d'ajouter la photo libre", {
          description: err instanceof Error ? err.message : "Réessayez.",
        });
      }
    })();
  };


  const handleSelfieFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;

    const stepId = currentStep.id;
    let previewUrl: string | undefined;

    try {
      const stableFile = await prepareCapturedImage(raw);
      previewUrl = URL.createObjectURL(stableFile);
      setState(stepId, { status: "uploading", previewUrl });

      let compressed: File;
      try {
        compressed = await compressImage(stableFile);
      } catch {
        compressed = stableFile;
      }
      const path = `${userId}/${attributionId}/selfie_${Date.now()}.jpg`;
      await uploadWithRetry("mission-selfies", path, compressed);

      let coords: { lat?: number; lng?: number; acc?: number } = {};
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject,
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 });
        });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
      } catch { /* géoloc optionnelle */ }

      const { error } = await supabase.from("mission_selfies").insert({
        attribution_id: attributionId,
        convoyeur_user_id: userId,
        storage_path: path,
        latitude: coords.lat ?? null,
        longitude: coords.lng ?? null,
        accuracy: coords.acc ?? null,
      });
      if (error) throw error;

      setState(stepId, { status: "success", previewUrl, storagePath: path });
      toast.success("Selfie validé");
      // Pas d'auto-avance · utilisateur appuie sur "Photo suivante".
    } catch (err) {
      console.error("[EDL Premium] selfie failed", err);
      setState(stepId, {
        status: "error", previewUrl,
        error: err instanceof Error ? err.message : "Erreur",
      });
      toast.error("Échec selfie", {
        description: err instanceof Error ? err.message : "Réessayez.",
      });
    }
  };

  const handleSignature = async (file: File) => {
    const stepId = currentStep.id;
    const sigKind = currentStep.signatureKind!;
    const signerName = sigKind.startsWith("driver") ? driverName : (signatureClientName || "Client");

    setState(stepId, { status: "uploading" });

    try {
      // Upload signature image dans bucket mission-documents
      const path = `${attributionId}/signature_${sigKind}_${Date.now()}.png`;
      await uploadWithRetry("mission-documents", path, file);

      // Lit en data URL pour stocker signature_data
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { error } = await supabase.from("mission_signatures").upsert({
        attribution_id: attributionId,
        kind: sigKind,
        signer_name: signerName,
        signature_data: dataUrl,
        signed_by_user_id: userId,
      }, { onConflict: "attribution_id,kind" });
      if (error) throw error;

      // Remontée admin : insère également une entrée dans mission_documents
      // pour MissionTraceability + PV avec un type canonique. On laisse "best-effort"
      // (pas de throw) car la signature elle-même est déjà persistée.
      const docKey = SIGNATURE_DOC_KEY[sigKind];
      if (docKey) {
        try {
          await supabase.from("mission_documents").insert({
            attribution_id: attributionId,
            uploaded_by: userId,
            type_document: docKey,
            nom_fichier: `${docKey}.png`,
            url_fichier: path,
          });
        } catch (docErr) {
          console.warn("[EDL Premium] mission_documents insert failed (non bloquant)", docErr);
        }
      }

      setState(stepId, { status: "success", storagePath: path, previewUrl: dataUrl });
      toast.success("Signature validée");
      // Pas d'auto-avance · utilisateur appuie sur "Étape suivante".
    } catch (err) {
      console.error("[EDL Premium] signature failed", err);
      setState(stepId, {
        status: "error",
        error: err instanceof Error ? err.message : "Erreur",
      });
      toastSignatureError(err);
    }
  };

  const handleValidationStep = async () => {
    const stepId = currentStep.id;
    setState(stepId, { status: "uploading" });

    try {
      if (stepId === "send_admin") {
        // Marquer attribution comme prête pour validation admin
        await writeWithOutbox(
          { kind: "update", table: "attributions", values: { etape_courante: "en_validation_admin" }, match: { id: attributionId } },
          "Envoi validation admin",
        );
        await writeWithOutbox(
          {
            kind: "insert",
            table: "mission_etape_history",
            values: {
              attribution_id: attributionId,
              etape: "envoi_validation_admin",
              notes: "EDL complet, envoyé pour validation",
              created_by: userId,
            },
          },
          "Historique validation admin",
        );
        setState(stepId, { status: "success" });
        toast.success("Envoyé à l'admin pour validation");
      } else if (stepId === "admin_validated") {
        // Cette étape attend la validation admin externe · elle ne se valide pas côté driver
        setState(stepId, { status: "success" });
        toast.info("Validation admin enregistrée");
      }
    } catch (err) {
      setState(stepId, {
        status: "error",
        error: err instanceof Error ? err.message : "Erreur",
      });
    }
  };

  const finalizeInspection = useCallback(async () => {
    // L'inspection peut ne pas encore exister (parcours sans photo, étapes
    // bypassées par l'admin…) : on la crée à la volée plutôt que d'échouer.
    let insId = inspectionId;
    if (!insId) {
      try {
        insId = await ensureInspection();
      } catch (err) {
        console.warn("[EDL Premium] ensureInspection à la finalisation a échoué", err);
        insId = null;
      }
    }

    if (insId) {
      const { error: inspectionError } = await supabase
        .from("inspections")
        .update({ statut: "complete" })
        .eq("id", insId);
      // Non bloquant : la mission doit pouvoir se terminer même si la ligne
      // d'inspection n'est pas modifiable (RLS, hors-ligne…).
      if (inspectionError) console.warn("[EDL Premium] update inspection statut", inspectionError);
    }

    if (type === "arrivee") {
      // On marque seulement l'EDL arrivée comme faite. Le selfie final et
      // l'envoi à l'admin sont déclenchés depuis le cockpit mission · pas ici.
      await Promise.all([
        writeWithOutbox(
          { kind: "update", table: "attributions", values: { etape_courante: "edl_arrivee_fait" }, match: { id: attributionId } },
          "EDL arrivée",
        ),
        writeWithOutbox(
          {
            kind: "insert",
            table: "mission_etape_history",
            values: {
              attribution_id: attributionId,
              etape: "edl_arrivee_fait",
              notes: "EDL arrivée terminé, en attente du selfie final puis envoi admin",
              created_by: userId,
            },
          },
          "Historique EDL arrivée",
        ),
      ]);
    }
  }, [attributionId, ensureInspection, inspectionId, type, userId]);

  // ─────────────────────────── NAVIGATION ───────────────────────────
  /** Bypass admin : étape considérée passable si admin a posé un override skip/disable */
  const isStepBypassed = (step: EdlStepDef): boolean => {
    if (step.kind === "signature" && step.signatureKind) return isDisabled(step.signatureKind);
    if (step.kind === "selfie") return isDisabled("selfie");
    // Photos + scans : bypass via step.id (ex: "pv_livraison", "carte_grise", ou tout vue_type)
    return isDisabled(step.id);
  };

  const canAdvance = () => {
    const s = currentState?.status;
    if (currentStep.kind === "extras") return true;
    // Étape finale "admin_validated" : on autorise toujours à terminer le parcours côté driver.
    if (currentStep.kind === "validation" && (currentStep.id === "admin_validated" || currentStep.id === "edl_recap")) {
      return true;
    }
    if (isStepBypassed(currentStep)) return true;
    // Étapes photo/scan : dès qu'une photo a été capturée (preview locale présente),
    // on autorise "Photo suivante". L'upload finalise en arrière-plan ; en cas d'échec,
    // un bouton "Réessayer l'envoi" séparé reste disponible.
    if (currentStep.kind === "photo" || currentStep.kind === "scan") {
      if (s === "success" || s === "uploading") return true;
      if (s === "error" && currentState?.previewUrl) return true;
      return false;
    }
    return s === "success";
  };


  const goNext = () => {
    if (completing) return;
    if (!canAdvance()) {
      toast.error("Validez cette étape avant de continuer");
      setFinalError("Validez cette étape avant de continuer.");
      return;
    }
    if (safeIndex < TOTAL - 1) {
      setStepIndex(safeIndex + 1);
    } else {
      setFinalError(null);
      setCompleting(true);
      void finalizeInspection()
        .then(() => {
          try { localStorage.removeItem(STORAGE_KEY(attributionId, type)); } catch { /* ignore */ }
          onComplete();
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Réessayez dans quelques secondes.";
          toast.error("Impossible de finaliser l'inspection", { description: message });
          setFinalError(message);
        })
        .finally(() => {
          setCompleting(false);
        });
    }
  };

  const goPrev = () => { if (safeIndex > 0) setStepIndex(safeIndex - 1); };

  const removeExtraPhoto = async (photoId: string) => {
    const stepId = currentStep.id;
    const target = currentState?.extras?.find((item) => item.id === photoId);
    if (!target) return;

    setStates((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] ?? { status: "idle" as const }),
        status: "success",
        extras: (prev[stepId]?.extras ?? []).filter((item) => item.id !== photoId),
      },
    }));

    revokeBlobUrl(target.previewUrl);

    if (!inspectionId || !target.storagePath) return;
    try {
      await supabase.from("inspection_photos").delete().eq("inspection_id", inspectionId).eq("url_photo", target.storagePath);
      await supabase.storage.from("inspection-photos").remove([target.storagePath]);
    } catch {
      // non bloquant
    }
  };

  const retake = () => {
    setStates(prev => {
      const next = { ...prev };
      revokeBlobUrl(next[currentStep.id]?.previewUrl);
      delete next[currentStep.id];
      return next;
    });
    // Rouvre directement l'appareil photo pour les étapes capture
    if (currentStep.kind === "photo" || currentStep.kind === "scan" || currentStep.kind === "selfie") {
      // setTimeout pour laisser React re-render avant le clic sur input file
      setTimeout(() => fileRef.current?.click(), 50);
    }
  };

  /** Réessaie l'upload du blob déjà capturé (sans demander de reprendre la photo). */
  const retryUpload = async () => {
    const stepId = currentStep.id;
    const target = states[stepId];
    if (!target?.previewUrl) {
      // Pas de blob local : on doit reprendre la photo
      retake();
      return;
    }
    setState(stepId, { ...target, status: "uploading", error: undefined });
    try {
      const resp = await fetch(target.previewUrl);
      const blob = await resp.blob();
      const file = new File([blob], `${stepId}.jpg`, { type: blob.type || "image/jpeg" });
      const insId = await ensureInspection();
      const compressed = await compressImage(file).catch(() => file);
      const path = `${userId}/${insId}/${stepId}.jpg`;
      await uploadWithRetry("inspection-photos", path, compressed);
      await supabase.from("inspection_photos")
        .delete().eq("inspection_id", insId).eq("vue_type", stepId);
      const { error: insertErr } = await supabase.from("inspection_photos").insert({
        inspection_id: insId, vue_type: stepId, url_photo: path, file_size_bytes: compressed.size,
      });
      if (insertErr) {
        const { error: upsertErr } = await supabase.from("inspection_photos").upsert(
          { inspection_id: insId, vue_type: stepId, url_photo: path, file_size_bytes: compressed.size },
          { onConflict: "inspection_id,vue_type" },
        );
        if (upsertErr) throw upsertErr;
      }
      setState(stepId, { status: "success", previewUrl: target.previewUrl, storagePath: path });
      toast.success("Envoi réussi");
    } catch (err) {
      setState(stepId, {
        ...target,
        status: "error",
        error: err instanceof Error ? err.message : "Erreur réseau",
      });
      toast.error("Nouvel échec d'envoi", { description: "Vérifiez votre connexion." });
    }
  };

  const deleteCurrentPhoto = async () => {
    const stepId = currentStep.id;
    const target = currentState;
    setStates(prev => {
      const next = { ...prev };
      revokeBlobUrl(next[stepId]?.previewUrl);
      delete next[stepId];
      return next;
    });
    if (!target?.storagePath) return;
    try {
      if (currentStep.kind === "selfie") {
        await supabase.from("mission_selfies").delete().eq("attribution_id", attributionId).eq("storage_path", target.storagePath);
        await supabase.storage.from("mission-selfies").remove([target.storagePath]);
      } else if (inspectionId) {
        await supabase.from("inspection_photos").delete().eq("inspection_id", inspectionId).eq("vue_type", stepId);
        await supabase.storage.from("inspection-photos").remove([target.storagePath]);
      }
      toast.success("Photo supprimée");
    } catch (err) {
      console.warn("[EDL] delete failed", err);
    }
  };

  // ─────────────────────────── RENDER ───────────────────────────
  if (!currentStep) {
    if (typeof document === "undefined") return null;
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#06091e] p-6 text-center text-white">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-lg font-bold">Aucun point de contrôle configuré</h2>
          <p className="mt-2 text-sm text-white/70">
            Aucune étape d'inspection n'est disponible pour cette phase. Revenez à la mission et contactez l'admin si le problème persiste.
          </p>
          <button
            onClick={onClose}
            className="mt-5 w-full h-11 rounded-xl bg-emerald-500/20 text-emerald-100 font-semibold hover:bg-emerald-500/30 transition"
          >
            Retour à la mission
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  // La checklist sécurité (gilet, tenue…) est validée une seule fois,
  // au moment du départ vers le véhicule (cockpit mission).

  // Vérification de plaque OBLIGATOIRE avant la première photo de l'EDL.
  if (!plateChecked) {
    if (typeof document === "undefined") return null;
    return createPortal(
      <PlateCheckGate
        attributionId={attributionId}
        userId={userId}
        phase={type}
        expectedPlate={vehicule?.immatriculation ?? null}
        driverName={driverName}
        onValidated={markPlateChecked}
        onClose={onClose}
      />,
      document.body,
    );
  }




  const overlay = (

    <div className="edl-shell fixed inset-x-0 top-0 z-[100] flex flex-col" style={{ height: "100dvh", maxHeight: "100dvh" }}>

      {/* === HEADER GLASS === */}
      <header className="edl-glass-strong rounded-none border-x-0 border-t-0 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => setAskExit(true)}
          className="w-10 h-10 rounded-xl edl-glass flex items-center justify-center hover:scale-95 transition"
          aria-label="Quitter"
        >
          <X size={18} className="text-white" />
        </button>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <img src={logoLigneo()} alt="Ligneo" className="w-9 h-9 object-contain shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--edl-cyan)] font-bold truncate">
              {EDL_SECTION_LABEL[currentStep.section]}
            </p>
            <p className="text-sm font-semibold text-white truncate">
              Étape {safeIndex + 1}/{TOTAL}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-[var(--edl-text-soft)]">Avancement</p>
          <p className="text-sm font-bold text-white tabular-nums">{progressPct}%</p>
        </div>
      </header>

      {/* === IDENTITÉ VÉHICULE (plaque + VIN) === */}
      <div className="px-4 pt-2 flex items-center gap-2 flex-wrap shrink-0">
        <span
          className="edl-chip"
          style={{ opacity: vehicule?.immatriculation ? 1 : 0.5 }}
          title="Plaque d'immatriculation"
        >
          {vehicule?.immatriculation || "Plaque non renseignée"}
        </span>
        <span
          className="edl-chip"
          style={{ opacity: vehicule?.vin ? 1 : 0.5, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title="Numéro VIN"
        >
          VIN&nbsp;: {vehicule?.vin || "non renseigné"}
        </span>
      </div>


      {/* === BARRE PROGRESSION ÉLECTRIQUE === */}
      <div className="px-4 py-2 shrink-0">
        <div className="relative h-1.5 rounded-full bg-white/8 overflow-hidden">
          <div
            className="edl-electric-bar absolute left-0 top-0 h-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* === CONTENU SCROLLABLE === */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 pt-2">
        <div key={currentStep.id} className="max-w-2xl mx-auto space-y-4 edl-step-enter">

          {/* Titre étape */}
          <div className="edl-glass p-5">
            <div className="flex items-start gap-3">
              <StepIcon kind={currentStep.kind} state={currentState?.status} />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-white leading-tight">
                  {currentStep.label}
                </h2>
                <p className="mt-1 text-sm text-[var(--edl-text-soft)] leading-snug">
                  {currentStep.hint}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="edl-chip">
                    {safeIndex + 1}/{TOTAL}
                  </span>
                  {currentStep.kind === "scan" && (
                    <span className="edl-chip-gold edl-chip">
                      <ScanLine size={11}/> Scan auto
                    </span>
                  )}
                  {currentState?.status === "success" && (
                    <span className="edl-chip edl-chip-success">
                      <Check size={11}/> Validée
                    </span>
                  )}
                  {isStepBypassed(currentStep) && (
                    <span className="edl-chip" style={{ background: "rgba(251,191,36,0.18)", borderColor: "rgba(251,191,36,0.4)", color: "#fde68a" }}>
                      <ShieldAlert size={11}/> Bypass admin
                    </span>
                  )}
                  {currentState?.ocr?.status === "pending" && (
                    <span className="edl-chip">
                      <Loader2 size={11} className="animate-spin"/> OCR en cours
                    </span>
                  )}
                  {currentState?.ocr?.status === "completed" && (
                    <span className="edl-chip edl-chip-success">
                      <FileSearch size={11}/> OCR · {currentState.ocr.fieldsCount ?? 0} champs · {currentState.ocr.classification === "admin" ? "→ Admin" : currentState.ocr.classification === "client" ? "→ Client" : "→ Driver"}
                    </span>
                  )}
                  {currentState?.ocr?.status === "failed" && (
                    <span className="edl-chip" style={{ background: "rgba(239,68,68,0.18)", borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }}>
                      OCR indisponible
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* === ZONE INTERACTION SELON TYPE === */}
          {(currentStep.kind === "photo" || currentStep.kind === "scan") && (
            <PhotoOrScanArea
              step={currentStep}
              state={currentState}
              onCapture={triggerCapture}
              onSimpleCapture={triggerSimpleCapture}
              onSkipScan={skipCurrentScan}
              onMarkAbsent={currentStep.id === "kit_securite" ? markKitAbsent : undefined}

              onRetake={retake}
              onDelete={deleteCurrentPhoto}
              onRetryUpload={retryUpload}
              inspectionId={inspectionId}
              driverName={driverName}
            />
          )}

          {currentStep.kind === "selfie" && (
            <SelfieArea
              state={currentState}
              onCapture={triggerCapture}
              onRetake={retake}
              onDelete={deleteCurrentPhoto}
              onRetryUpload={retryUpload}
            />
          )}

          {currentStep.kind === "extras" && (
            <ExtraPhotosArea
              state={currentState}
              onCapture={triggerCapture}
              onRemove={removeExtraPhoto}
            />
          )}

          {currentStep.kind === "signature" && (
            <SignatureArea
              step={currentStep}
              state={currentState}
              clientName={signatureClientName}
              setClientName={setSignatureClientName}
              onSign={handleSignature}
              onReset={retake}
            />
          )}

          {currentStep.kind === "validation" && (
            <ValidationArea
              step={currentStep}
              state={currentState}
              vehicule={vehicule}
              onTrigger={handleValidationStep}
              retour={type === "arrivee" ? { livraison: livraison ?? "", electrique: isElectric } : undefined}
              recap={(() => {
                const photoSteps = STEPS.filter((x) => x.kind === "photo");
                const sigSteps = STEPS.filter((x) => x.kind === "signature");
                const kmStep = STEPS.filter((x) => x.kind === "kilometrage").map((x) => states[x.id]).find((x) => x?.kilometrage != null);
                const equip = STEPS.filter((x) => x.kind === "checklist").map((x) => states[x.id]?.equipements).find(Boolean) ?? null;
                return {
                  type,
                  photosDone: photoSteps.filter((x) => states[x.id]?.status === "success").length,
                  photosTotal: photoSteps.length,
                  extras: Object.values(states).reduce((n, x) => n + (x?.extras?.filter((e) => e.status === "success").length ?? 0), 0),
                  km: kmStep?.kilometrage ?? null,
                  niveau: kmStep?.niveau ?? null,
                  equip,
                  sigDone: sigSteps.filter((x) => states[x.id]?.status === "success").length,
                  sigTotal: sigSteps.length,
                };
              })()}
            />
          )}

          {currentStep.kind === "checklist" && (
            <ChecklistArea state={currentState} onValidate={validateChecklist} />
          )}

          {currentStep.kind === "kilometrage" && (
            <KilometrageArea step={currentStep} state={currentState} onValidate={validateKilometrage} electric={isElectric} hasPhoto={states["compteur"]?.status === "success"} onRead={readCompteur} />
          )}



        </div>

        {/* Input file caché · type adapté.
            Le `key` change à chaque étape : on force React à remonter
            l'élément <input>. Sans ça, iOS Safari (et certains Chrome
            Android) refusent de réouvrir la caméra après la première
            capture, ce qui obligeait le convoyeur à actualiser la page
            pour passer à la photo suivante. */}
        <input
          key={`edl-file-${currentStep.id}`}
          ref={fileRef}
          type="file"
          accept="image/*"
          capture={currentStep.kind === "selfie" ? "user" : "environment"}
          onChange={currentStep.kind === "selfie" ? handleSelfieFile : currentStep.kind === "extras" ? handleExtraPhotoFile : handlePhotoFile}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", left: -9999 }}
          tabIndex={-1}
          aria-hidden="true"
        />
      </main>

      {/* === BARRE NAV STICKY BAS · toujours visible, mobile-first === */}
      <footer
        className="edl-glass-strong rounded-none border-x-0 border-b-0 shrink-0 safe-bottom"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {/* Indicateur d'étape compact, lisible sur mobile */}
        <div className="px-4 pt-2 pb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em]">
          <span className="text-[var(--edl-text-soft)] truncate">
            {EDL_SECTION_LABEL[currentStep.section]}
          </span>
          <div className="flex items-center gap-2">
            {!online && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40 normal-case tracking-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Hors-ligne · reprise auto
              </span>
            )}
            <span className="text-white font-bold tabular-nums">
              Étape {safeIndex + 1}/{TOTAL}
            </span>
          </div>
        </div>
        {finalError && (
          <div className="px-4 pb-1">
            <p className="text-[11px] text-red-300 bg-red-500/10 ring-1 ring-red-400/30 rounded-lg px-3 py-2">
              {finalError}
            </p>
          </div>
        )}
        <div className="px-4 pt-2 pb-3 flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={safeIndex === 0}
            className="w-12 h-12 rounded-xl edl-glass flex items-center justify-center disabled:opacity-30 hover:scale-95 transition shrink-0"
            aria-label="Étape précédente"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>

          <button
            onClick={goNext}
            disabled={!canAdvance() || completing}
            className="edl-cta flex-1 h-12 px-4 flex items-center justify-center gap-2 disabled:opacity-50 text-sm font-semibold"
          >
            {completing
              ? "Finalisation…"
              : safeIndex === TOTAL - 1
                ? "Terminer l'état des lieux"
                : currentStep.kind === "photo" || currentStep.kind === "scan"
                  ? "Photo suivante"
                  : "Étape suivante"}
            {completing ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          </button>
        </div>
      </footer>

      {/* Modal Quitter */}
      {askExit && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="edl-glass-strong p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white">Quitter l'état des lieux ?</h3>
            <p className="mt-2 text-sm text-[var(--edl-text-soft)]">
              Votre progression est sauvegardée. Vous pourrez reprendre où vous en êtes.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setAskExit(false)}
                className="flex-1 h-11 rounded-xl edl-glass text-white font-semibold"
              >
                Continuer
              </button>
              <button
                onClick={() => { setAskExit(false); onClose(); }}
                className="flex-1 h-11 rounded-xl bg-red-500/20 border border-red-400/40 text-red-200 font-semibold"
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}

      {openScanner && (
        <DocumentScanner
          onCancel={() => setOpenScanner(false)}
          onScanned={async (file) => {
            setOpenScanner(false);
            await processPhotoFile(file);
          }}
        />
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(<div className="drv2">{overlay}</div>, document.body);
}

/* ═════════════════════════ SUB-COMPONENTS ═════════════════════════ */

function StepIcon({ kind, state }: { kind: EdlStepDef["kind"]; state?: StepState["status"] }) {
  const ok = state === "success";
  const cls = `w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
    ok
      ? "bg-emerald-500/20 border border-emerald-400/50 text-emerald-300"
      : "bg-[var(--edl-electric)]/20 border border-[var(--edl-cyan)]/40 text-[var(--edl-cyan)] edl-pulse"
  }`;
  const icon = ok ? <Check size={22}/> : (
    kind === "selfie" ? <UserCircle2 size={22}/> :
    kind === "signature" ? <PenLine size={22}/> :
    kind === "scan" ? <ScanLine size={22}/> :
    kind === "validation" ? <ShieldCheck size={22}/> :
    <Camera size={22}/>
  );
  return <div className={cls}>{icon}</div>;
}

function PhotoOrScanArea({
  step, state, onCapture, onSimpleCapture, onSkipScan, onMarkAbsent, onRetake, onDelete, onRetryUpload,
  inspectionId, driverName,
}: {
  inspectionId?: string | null; driverName?: string;
  step: EdlStepDef; state?: StepState; onCapture: () => void;
  onSimpleCapture?: () => void; onSkipScan?: () => void;
  onMarkAbsent?: () => void;
  onRetake: () => void; onDelete: () => void; onRetryUpload?: () => void;
}) {

  const taken = Boolean(state?.previewUrl);

  return (
    <div className="space-y-3">
      {/* Photo exemple grande visible AVANT prise (jamais cachée) */}
      {step.example && !taken && (
        <div className="edl-photo-frame">
          <img
            src={step.example}
            alt={`Exemple : ${step.label}`}
            className="w-full aspect-[4/3] sm:aspect-[3/2] object-cover max-h-[36dvh] sm:max-h-none"
            loading="lazy"
            width={768}
            height={512}
          />
          <div className="absolute top-3 left-3 z-10">
            <span className="edl-chip edl-chip-gold">
              <Sparkles size={11}/> Exemple
            </span>
          </div>
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <p className="text-xs font-semibold text-white drop-shadow-lg">
              Cadrez votre photo de la même façon
            </p>
          </div>
        </div>
      )}

      {/* Photo annotable (étapes photo, après prise) */}
      {step.kind === "photo" && state?.previewUrl && state.status !== "error" && (
        <PhotoAnnotationEditor
          key={state.captureId ?? state.storagePath ?? step.id}
          src={state.previewUrl}
          inspectionId={inspectionId ?? null}
          vueType={step.id}
          authorName={driverName}
        />
      )}

      {/* Aperçu après prise */}
      {state?.previewUrl && !(step.kind === "photo" && state.status !== "error") && (
        <div className="edl-photo-frame relative">
          <img
            src={state.previewUrl}
            alt="Votre prise"
            className="w-full aspect-[4/3] sm:aspect-[3/2] object-cover max-h-[36dvh] sm:max-h-none"
          />
          {state.status === "uploading" && <BrandLoader label="Envoi sécurisé…" />}
          <div className="absolute top-3 right-3 z-30">
            {state.status === "success" && (
              <span className="edl-chip edl-chip-success">
                <Check size={11}/> Envoyée
              </span>
            )}
            {state.status === "error" && (
              <span className="edl-chip" style={{ background: "rgba(239,68,68,0.2)", borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }}>
                Échec
              </span>
            )}
          </div>
        </div>
      )}

      {state?.error && (
        <div className="edl-glass p-3 text-sm text-red-200 border border-red-400/30">
          {state.error}
        </div>
      )}

      {/* CTA prise / reprise */}
      {!state || state.status === "idle" || state.status === "error" ? (
        <div className="space-y-2">
          {state?.status === "error" && state.previewUrl && onRetryUpload && (
            <button
              onClick={onRetryUpload}
              className="edl-cta w-full h-12 flex items-center justify-center gap-2 text-sm bg-amber-500 hover:bg-amber-600 text-black"
            >
              <RefreshCw size={16}/> Réessayer l'envoi
            </button>
          )}
          <button
            onClick={onCapture}
            className="edl-cta w-full h-14 sm:h-16 flex items-center justify-center gap-3 text-base"
          >
            {step.kind === "scan" ? <ScanLine size={22}/> : <Camera size={22}/>}
            {step.kind === "scan" ? "Scanner le document" : "Prendre la photo"}
          </button>

          {/* Pour les étapes scan : alternatives pour ne pas bloquer */}
          {step.kind === "scan" && (
            <div className="grid grid-cols-2 gap-2">
              {onSimpleCapture && (
                <button
                  onClick={onSimpleCapture}
                  className="h-11 rounded-2xl edl-glass text-white font-semibold flex items-center justify-center gap-2 text-sm"
                >
                  <Camera size={15}/> Photo simple
                </button>
              )}
              {onSkipScan && (
                <button
                  onClick={onSkipScan}
                  className="h-11 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-100 font-semibold flex items-center justify-center gap-2 text-sm"
                >
                  Ignorer le scan
                </button>
              )}
            </div>
          )}

          {/* Kit de sécurité absent du véhicule → étape passable */}
          {onMarkAbsent && (
            <button
              type="button"
              onClick={onMarkAbsent}
              className="w-full flex items-center gap-3 text-left rounded-2xl p-3 edl-glass"
            >
              <span
                className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center"
                style={{ border: "1.5px solid rgba(120,180,255,0.45)" }}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-white">
                  Kit de sécurité absent du véhicule
                </span>
                <span className="block text-[11px] text-[var(--edl-text-soft)]">
                  Cochez pour passer cette photo · l'absence sera signalée.
                </span>
              </span>
            </button>
          )}
        </div>

      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onRetake}
            className="h-11 sm:h-12 rounded-2xl edl-glass text-white font-semibold flex items-center justify-center gap-2"
          >
            <RefreshCw size={16}/> Reprendre
          </button>
          <button
            onClick={onDelete}
            className="h-11 sm:h-12 rounded-2xl bg-red-500/15 border border-red-400/30 text-red-200 font-semibold flex items-center justify-center gap-2"
          >
            <X size={16}/> Supprimer
          </button>
        </div>
      )}


      {step.kind === "scan" && (
        <div className="edl-glass p-3 text-xs text-[var(--edl-text-soft)] flex items-start gap-2">
          <ScanLine size={14} className="text-[var(--edl-gold)] shrink-0 mt-0.5"/>
          <span>OCR optionnel : si le scan ne fonctionne pas, utilisez "Photo simple" ou "Ignorer le scan" pour continuer.</span>
        </div>
      )}
    </div>
  );
}

function SelfieArea({
  state, onCapture, onRetake, onDelete, onRetryUpload,
}: { state?: StepState; onCapture: () => void; onRetake: () => void; onDelete: () => void; onRetryUpload?: () => void }) {
  return (
    <div className="space-y-3">
      <div className="edl-glass p-5 text-center">
        <div className="relative mx-auto w-32 h-32 rounded-full edl-glass-strong flex items-center justify-center overflow-hidden">
          {state?.previewUrl ? (
            <img src={state.previewUrl} alt="Selfie" className="w-full h-full object-cover" />
          ) : (
            <UserCircle2 size={56} className="text-[var(--edl-cyan)]" />
          )}
          {state?.status === "uploading" && <BrandLoader compact label="Envoi…" />}
        </div>
        <p className="mt-4 text-sm text-[var(--edl-text-soft)]">
          Identifiez-vous en début de mission. Photo géolocalisée et horodatée.
        </p>
        <p className="mt-2 text-xs text-[var(--edl-cyan)] flex items-center justify-center gap-1.5">
          <MapPin size={12}/> Géolocalisation activée
        </p>
        {state?.error && (
          <p className="mt-3 text-sm text-red-200">
            {state.error}
          </p>
        )}
      </div>

      {!state || state.status === "idle" || state.status === "error" ? (
        <div className="space-y-2">
          {state?.status === "error" && state.previewUrl && onRetryUpload && (
            <button onClick={onRetryUpload} className="edl-cta w-full h-12 flex items-center justify-center gap-2 text-sm bg-amber-500 hover:bg-amber-600 text-black">
              <RefreshCw size={16}/> Réessayer l'envoi
            </button>
          )}
          <button onClick={onCapture} className="edl-cta w-full h-16 flex items-center justify-center gap-3 text-base">
            <Camera size={22}/> Prendre le selfie
          </button>
        </div>
      ) : state.status === "uploading" ? (
        <button disabled className="edl-cta w-full h-16 flex items-center justify-center gap-3 text-base opacity-70">
          <Loader2 size={22} className="animate-spin"/> Validation en cours…
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onRetake} className="h-12 rounded-2xl edl-glass text-white font-semibold flex items-center justify-center gap-2">
            <RefreshCw size={16}/> Reprendre
          </button>
          <button onClick={onDelete} className="h-12 rounded-2xl bg-red-500/15 border border-red-400/30 text-red-200 font-semibold flex items-center justify-center gap-2">
            <X size={16}/> Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

function ExtraPhotosArea({
  state,
  onCapture,
  onRemove,
}: {
  state?: StepState;
  onCapture: () => void;
  onRemove: (photoId: string) => void;
}) {
  const extras = state?.extras ?? [];

  return (
    <div className="space-y-3">
      <div className="edl-glass p-4">
        <p className="text-sm font-semibold text-white">Photos libres / dégâts</p>
        <p className="mt-1 text-xs text-[var(--edl-text-soft)]">
          Étape optionnelle : ajoutez des photos complémentaires, dégâts, remarques ou accessoires. Vous pouvez continuer même sans photo.
        </p>
      </div>

      <button
        onClick={onCapture}
        className="edl-cta w-full h-16 flex items-center justify-center gap-3 text-base"
      >
        <Camera size={22}/> Ajouter une photo libre
      </button>

      {extras.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {extras.map((item, index) => (
            <div key={item.id} className="edl-photo-frame">
              <img src={item.previewUrl} alt={`Photo libre ${index + 1}`} className="w-full aspect-square object-cover" />
              <div className="absolute top-3 right-3 z-10">
                <span className="edl-chip">
                  {item.status === "uploading" ? <Loader2 size={11} className="animate-spin"/> : item.status === "success" ? <Check size={11}/> : <X size={11}/>}
                  {item.status === "uploading" ? " Envoi…" : item.status === "success" ? " Enregistrée" : " Erreur"}
                </span>
              </div>
              <button
                onClick={() => onRemove(item.id)}
                className="absolute bottom-3 right-3 z-10 rounded-full bg-black/60 p-2 text-white"
                aria-label="Supprimer la photo"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SignatureArea({
  step, state, clientName, setClientName, onSign, onReset,
}: {
  step: EdlStepDef;
  state?: StepState;
  clientName: string;
  setClientName: (v: string) => void;
  onSign: (file: File) => void;
  onReset: () => void;
}) {
  const isClient = step.signatureKind?.includes("client");
  const done = state?.status === "success";

  return (
    <div className="space-y-3">
      {isClient && !done && (
        <div className="sigx-field">
          <label htmlFor="sig-client-name">Nom du signataire</label>
          <input
            id="sig-client-name"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
            enterKeyHint="done"
            autoComplete="off"
            placeholder="Prénom et nom"
          />
        </div>
      )}

      {done ? (
        <div className="edl-glass p-5 text-center">
          {state?.previewUrl && (
            <img src={state.previewUrl} alt="Signature" className="mx-auto max-h-32 bg-white rounded-lg p-2" />
          )}
          <p className="mt-3 text-sm text-emerald-300 font-semibold flex items-center justify-center gap-1.5">
            <Check size={14}/> Signature enregistrée
          </p>
          <button
            onClick={onReset}
            className="mt-3 text-xs text-[var(--edl-cyan)] underline"
          >
            Refaire la signature
          </button>
        </div>
      ) : (
        <SignatureCanvas key={step.id} onValidate={onSign} disabled={state?.status === "uploading"} />
      )}
    </div>
  );
}

type RecapData = {
  type: "depart" | "arrivee";
  photosDone: number; photosTotal: number; extras: number;
  km: number | null; niveau: number | null;
  equip: StepState["equipements"] | null;
  sigDone: number; sigTotal: number;
};

function ValidationArea({
  step, state, vehicule, onTrigger, retour, recap,
}: { step: EdlStepDef; state?: StepState; vehicule?: VehiculeInfo; onTrigger: () => void; retour?: { livraison: string; electrique: boolean }; recap?: RecapData }) {
  const done = state?.status === "success";
  const vehTitle = [vehicule?.marque, vehicule?.modele].filter(Boolean).join(" ");

  // Récapitulatif de fin d'EDL : aucune mention de l'admin (le selfie final et l'envoi viennent après).
  if (step.id === "edl_recap") {
    const eq = recap?.equip;
    const yes = (v: boolean) => (v ? "Oui" : "Non");
    const roueLabel = eq?.roue === "secours" ? "Roue de secours" : eq?.roue === "kit" ? "Kit anti-crevaison" : eq?.roue === "aucun" ? "Aucune" : "—";
    return (
      <div className="rcp">
        <section className="rcp-hero">
          <span className="rcp-badge"><Check size={20} strokeWidth={3} /></span>
          <div>
            <b>État des lieux {recap?.type === "arrivee" ? "d'arrivée" : "de départ"} terminé</b>
            <small>Vérifiez le récapitulatif puis terminez.</small>
          </div>
        </section>

        <section className="rcp-card">
          <h4>Véhicule inspecté</h4>
          {vehTitle && <p className="rcp-veh">{vehTitle}</p>}
          <div className="rcp-plate">{vehicule?.immatriculation ? <PlateBadge plate={vehicule.immatriculation} size="md" /> : <span className="rcp-na">Plaque non renseignée</span>}</div>
          <div className="rcp-row"><span>N° de série (VIN)</span><b className={vehicule?.vin ? "" : "rcp-na"}>{vehicule?.vin || "Non renseigné"}</b></div>
        </section>

        <section className="rcp-grid">
          <div className="rcp-tile"><small>Photos</small><b>{recap ? `${recap.photosDone}/${recap.photosTotal}` : "—"}</b>{!!recap?.extras && <em>+{recap.extras} libre{recap.extras > 1 ? "s" : ""}</em>}</div>
          <div className="rcp-tile"><small>Signatures</small><b>{recap ? `${recap.sigDone}/${recap.sigTotal}` : "—"}</b></div>
          <div className="rcp-tile"><small>Kilométrage</small><b>{recap?.km != null ? `${recap.km.toLocaleString("fr-FR")} km` : "—"}</b></div>
          <div className="rcp-tile"><small>Niveau</small><b>{recap?.niveau != null ? `${recap.niveau} %` : "—"}</b></div>
        </section>

        {eq && (
          <section className="rcp-card">
            <h4>Équipements constatés</h4>
            <div className="rcp-chips">
              <span className={eq.extincteur ? "ok" : "ko"}>Extincteur · {yes(eq.extincteur)}</span>
              <span className={eq.kit_securite ? "ok" : "ko"}>Kit de sécurité · {yes(eq.kit_securite)}</span>
              {vehicule && (retour?.electrique || eq.cable_charge) ? <span className={eq.cable_charge ? "ok" : "ko"}>Câble de charge · {yes(eq.cable_charge)}</span> : null}
              <span className={eq.tapis_sol ? "ok" : "ko"}>Tapis de sol · {yes(eq.tapis_sol)}</span>
              <span className={eq.doubles_cles ? "ok" : "ko"}>Doubles clés · {yes(eq.doubles_cles)}</span>
              <span className="ok">{roueLabel}</span>
            </div>
          </section>
        )}

        {retour && (
          <section className="rcp-card rcp-retour">
            <h4>Préparer mon retour</h4>
            <RetourBlock livraison={retour.livraison} electrique={retour.electrique} />
          </section>
        )}
      </div>
    );
  }

  if (step.id === "admin_validated") {
    return (
      <div className="edl-glass p-6 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 edl-pulse">
          <ShieldCheck size={28}/>
        </div>
        <h3 className="mt-4 text-lg font-bold text-white">En attente de l'admin</h3>
        <p className="mt-2 text-sm text-[var(--edl-text-soft)]">
          Votre EDL a été transmis. L'admin va valider la mission. Vous recevrez une notification dès la validation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="edl-glass p-5 flex items-start gap-3">
        <FileText size={20} className="text-[var(--edl-gold)] shrink-0 mt-0.5"/>
        <div>
          <h3 className="text-base font-bold text-white">Récap &amp; envoi</h3>
          <p className="mt-1 text-sm text-[var(--edl-text-soft)]">
            Tout est complet : selfie, photos extérieur/intérieur, documents, signatures. Envoyez à l'admin pour validation finale.
          </p>
        </div>
      </div>

      <div className="edl-glass p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--edl-cyan)] font-bold">Véhicule inspecté</p>
        {vehTitle && <p className="text-sm font-semibold text-white">{vehTitle}</p>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--edl-text-soft)]">Plaque</span>
          <span className="text-sm font-bold text-white tabular-nums" style={{ opacity: vehicule?.immatriculation ? 1 : 0.45 }}>
            {vehicule?.immatriculation || "Non renseignée"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--edl-text-soft)]">VIN</span>
          <span className="text-sm font-semibold text-white truncate" style={{ opacity: vehicule?.vin ? 1 : 0.45 }}>
            {vehicule?.vin || "Non renseigné"}
          </span>
        </div>
      </div>

      {done ? (
        <div className="edl-glass p-4 text-center">
          <span className="edl-chip edl-chip-success">
            <Check size={11}/> Envoyé à l'admin
          </span>
        </div>
      ) : (
        <button
          onClick={onTrigger}
          disabled={state?.status === "uploading"}
          className="edl-cta-gold w-full h-16 flex items-center justify-center gap-3 text-base"
        >
          {state?.status === "uploading"
            ? <><Loader2 size={20} className="animate-spin"/> Envoi…</>
            : <><ShieldCheck size={20}/> Envoyer à l'admin</>
          }
        </button>
      )}
    </div>
  );
}

function BrandLoader({ label = "Envoi sécurisé…", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className="edl-brand-loader">
      <div
        className="edl-brand-loader__ring"
        style={compact ? { width: 72, height: 72 } : undefined}
      >
        <div className="edl-brand-loader__logo">
          <img src={logoLigneo()} alt="Ligneo" style={compact ? { width: 40, height: 40 } : undefined} />
        </div>
      </div>
      {!compact && <span className="edl-brand-loader__label">{label}</span>}
    </div>
  );
}

// ─────────────────────────── ÉQUIPEMENTS VÉHICULE ───────────────────────────
function ChecklistArea({
  state,
  onValidate,
}: {
  state?: StepState;
  onValidate: (equip: NonNullable<StepState["equipements"]>) => void;
}) {
  const initial = state?.equipements ?? {
    extincteur: false,
    kit_securite: false,
    cable_charge: false,
    tapis_sol: false,
    doubles_cles: false,
    roue: null,
  };
  const [extincteur, setExtincteur] = useState<boolean>(initial.extincteur);
  const [kitSec, setKitSec] = useState<boolean>(initial.kit_securite);
  const [cable, setCable] = useState<boolean>(initial.cable_charge);
  const [tapisSol, setTapisSol] = useState<boolean>(initial.tapis_sol ?? false);
  const [doublesCles, setDoublesCles] = useState<boolean>(initial.doubles_cles ?? false);
  const [roue, setRoue] = useState<NonNullable<StepState["equipements"]>["roue"]>(initial.roue);

  const isSaved = state?.status === "success";
  const isSaving = state?.status === "uploading";
  const canValidate = roue !== null;

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 12,
    border: `1px solid ${active ? "rgba(20,184,102,0.7)" : "rgba(20,184,102,0.22)"}`,
    background: active ? "rgba(20,184,102,0.12)" : "rgba(255,255,255,0.06)",
    color: "var(--edl-text)",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 500,
    transition: "all 0.15s",
    width: "100%",
    textAlign: "left",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 4px 12px" }}>
      <p style={{ color: "var(--edl-text-soft)", fontSize: 13, margin: 0 }}>
        Cochez la présence de chaque équipement avant de continuer.
      </p>

      <button type="button" onClick={() => setDoublesCles(v => !v)} style={itemStyle(doublesCles)}>
        <span style={{ fontSize: 22 }}>{doublesCles ? "✅" : "⬜"}</span>
        <span>Double des clés remis</span>
      </button>
      <button type="button" onClick={() => setExtincteur(v => !v)} style={itemStyle(extincteur)}>
        <span style={{ fontSize: 22 }}>{extincteur ? "✅" : "⬜"}</span>
        <span>Extincteur</span>
      </button>
      <button type="button" onClick={() => setKitSec(v => !v)} style={itemStyle(kitSec)}>
        <span style={{ fontSize: 22 }}>{kitSec ? "✅" : "⬜"}</span>
        <span>Kit de sécurité (gilet + triangle)</span>
      </button>
      <button type="button" onClick={() => setCable(v => !v)} style={itemStyle(cable)}>
        <span style={{ fontSize: 22 }}>{cable ? "✅" : "⬜"}</span>
        <span>Câble de recharge (si électrique)</span>
      </button>
      <button type="button" onClick={() => setTapisSol(v => !v)} style={itemStyle(tapisSol)}>
        <span style={{ fontSize: 22 }}>{tapisSol ? "✅" : "⬜"}</span>
        <span>Tapis de sol</span>
      </button>


      <div style={{ marginTop: 4 }}>
        <p style={{ color: "var(--edl-text)", fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>
          Roue de secours
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {([
            { v: "secours", l: "Roue secours" },
            { v: "kit", l: "Kit anti-crev." },
            { v: "aucun", l: "Aucun" },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setRoue(opt.v)}
              style={{
                padding: "12px 8px",
                borderRadius: 10,
                border: `1px solid ${roue === opt.v ? "rgba(20,184,102,0.7)" : "rgba(20,184,102,0.22)"}`,
                background: roue === opt.v ? "rgba(20,184,102,0.14)" : "rgba(255,255,255,0.06)",
                color: "var(--edl-text)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!canValidate || isSaving}
        onClick={() =>
          onValidate({ extincteur, kit_securite: kitSec, cable_charge: cable, tapis_sol: tapisSol, doubles_cles: doublesCles, roue })
        }
        style={{
          marginTop: 8,
          padding: "14px 16px",
          borderRadius: 12,
          border: "none",
          background: canValidate
            ? (isSaved ? "rgba(34,197,94,0.85)" : "linear-gradient(135deg,#14B866,#4FE8A0)")
            : "rgba(20,184,102,0.14)",
          color: canValidate ? "#04261a" : "var(--edl-muted)",
          fontSize: 15,
          fontWeight: 700,
          cursor: canValidate && !isSaving ? "pointer" : "not-allowed",
          opacity: isSaving ? 0.7 : 1,
        }}
      >
        {isSaving ? "Enregistrement…" : isSaved ? "✓ Équipements enregistrés" : "Valider les équipements"}
      </button>
    </div>
  );
}

// ─────────────────────────── KILOMÉTRAGE + NIVEAU ───────────────────────────
function KilometrageArea({
  step,
  state,
  onValidate,
  electric,
  hasPhoto,
  onRead,
}: {
  step: EdlStepDef;
  state?: StepState;
  onValidate: (km: number, niveau: number) => void;
  electric: boolean;
  hasPhoto: boolean;
  onRead: () => Promise<{ km: number | null; level_pct: number | null; suspicious: boolean } | null>;
}) {
  const [raw, setRaw] = useState<string>(state?.kilometrage ? String(state.kilometrage) : "");
  const [niveau, setNiveau] = useState<number>(state?.niveau ?? 50);
  const [touched, setTouched] = useState<boolean>(state?.niveau != null);
  const [auto, setAuto] = useState<"idle" | "reading" | "done" | "none">("idle");
  const [suspicious, setSuspicious] = useState(false);
  const value = Number(raw);
  const validKm = Number.isFinite(value) && value > 0 && value < 9999999;
  const valid = validKm && touched;
  const isSaved = state?.status === "success";
  const isSaving = state?.status === "uploading";
  const arr = step.id === "kilometrage_arrivee";
  const label = electric ? "Niveau de batterie" : "Niveau de carburant";

  // Lecture automatique de la photo : pré-remplit, l'utilisateur confirme.
  useEffect(() => {
    if (!hasPhoto || state?.kilometrage || auto !== "idle") return;
    let alive = true;
    setAuto("reading");
    void onRead().then((r) => {
      if (!alive) return;
      if (!r || (r.km == null && r.level_pct == null)) { setAuto("none"); return; }
      if (r.km != null && r.km > 0) setRaw(String(r.km));
      if (r.level_pct != null) { setNiveau(Math.max(0, Math.min(100, Math.round(r.level_pct / 5) * 5))); setTouched(true); }
      setSuspicious(!!r.suspicious);
      setAuto("done");
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPhoto]);

  const tone = niveau <= 15 ? "#ef4444" : niveau <= 30 ? "#f59e0b" : electric ? "#18b4ff" : "#14B866";
  const Icon = electric ? <Zap size={20} className="ic-bolt" fill="currentColor" /> : <Fuel size={20} color={tone} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 4px 12px" }}>
      {auto === "reading" && (
        <p style={{ color: "var(--edl-muted)", fontSize: 12.5, margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
          <Loader2 size={14} className="animate-spin" /> Lecture du compteur sur votre photo…
        </p>
      )}
      {auto === "done" && (
        <p style={{ color: "#0b7a43", fontSize: 12.5, margin: 0, fontWeight: 600 }}>
          ✓ Valeurs lues sur la photo : vérifiez et corrigez si besoin.
        </p>
      )}
      {suspicious && (
        <p style={{ color: "#b45309", fontSize: 12.5, margin: 0 }}>
          La photo du compteur doit être prise sur place, directement sur le tableau de bord. Reprenez-la si besoin.
        </p>
      )}

      <label style={{ color: "var(--edl-text)", fontSize: 13, fontWeight: 700 }}>
        {arr ? "Kilométrage affiché à l'arrivée" : "Kilométrage affiché au départ"}
      </label>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        value={raw}
        onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="Ex : 124583"
        style={{
          width: "100%",
          padding: "18px 18px",
          borderRadius: 14,
          border: "1px solid rgba(20,184,102,0.3)",
          background: "rgba(255,255,255,0.7)",
          color: "var(--edl-text)",
          fontSize: 28,
          fontWeight: 700,
          textAlign: "center",
          letterSpacing: "0.05em",
          outline: "none",
        }}
      />

      <div className="edl-niv" style={{ ["--tone" as string]: tone }}>
        <div className="edl-niv-head">
          <span>{Icon}{label}</span>
          <b>{touched ? `${niveau} %` : "—"}</b>
        </div>
        <div className="edl-niv-bar"><i style={{ width: `${touched ? niveau : 0}%` }} /></div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={niveau}
          onChange={(e) => { setNiveau(Number(e.target.value)); setTouched(true); }}
          aria-label={label}
        />
        <div className="edl-niv-ticks"><span>Vide</span><span>¼</span><span>½</span><span>¾</span><span>Plein</span></div>
        <div className="edl-niv-quick">
          {[0, 25, 50, 75, 100].map((n) => (
            <button key={n} type="button" className={touched && niveau === n ? "on" : ""} onClick={() => { setNiveau(n); setTouched(true); }}>{n} %</button>
          ))}
        </div>
      </div>
      <p style={{ color: "var(--edl-muted)", fontSize: 12, margin: 0, textAlign: "center" }}>
        {electric ? "Lisez le pourcentage de batterie sur l'écran du véhicule." : "Lisez la jauge : ½ réservoir = 50 %."} Le niveau figure sur le PV et l'état des lieux.
      </p>
      <button
        type="button"
        disabled={!valid || isSaving}
        onClick={() => onValidate(value, niveau)}
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          border: "none",
          background: valid
            ? (isSaved ? "rgba(34,197,94,0.85)" : "linear-gradient(135deg,#14B866,#4FE8A0)")
            : "rgba(20,184,102,0.14)",
          color: valid ? "#04261a" : "var(--edl-muted)",
          fontSize: 15,
          fontWeight: 700,
          cursor: valid && !isSaving ? "pointer" : "not-allowed",
          opacity: isSaving ? 0.7 : 1,
        }}
      >
        {isSaving ? "Enregistrement…" : isSaved ? `✓ ${value.toLocaleString("fr-FR")} km · ${niveau} % enregistrés` : validKm && !touched ? "Indiquez le niveau" : "Valider"}
      </button>
    </div>
  );
}


