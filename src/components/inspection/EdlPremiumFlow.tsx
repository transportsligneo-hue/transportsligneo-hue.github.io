/**
 * EdlPremiumFlow — Parcours EDL Premium glassmorphism bleu électrique (Lot 1).
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, ArrowRight, Camera, Check, Loader2, X, RefreshCw,
  ShieldCheck, PenLine, ScanLine, UserCircle2, Sparkles, FileText, MapPin,
  ShieldAlert, FileSearch,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import { useMissionGates } from "@/hooks/useMissionGates";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import {
  EDL_PREMIUM_SEQUENCE,
  EDL_TOTAL_STEPS,
  EDL_SECTION_LABEL,
  type EdlStepDef,
} from "./edl-premium-sequence";

interface Props {
  attributionId: string;
  type: "depart" | "arrivee";
  userId: string;
  driverName: string;
  /** Pour signatures client : nom à afficher par défaut */
  defaultClientName?: string;
  onComplete: () => void;
  onClose: () => void;
}

interface StepState {
  status: "idle" | "uploading" | "success" | "error";
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

export function EdlPremiumFlow({
  attributionId, type, userId, driverName, defaultClientName,
  onComplete, onClose,
}: Props) {
  const STEPS = useMemo(() => {
    if (type === "depart") {
      return EDL_PREMIUM_SEQUENCE.filter(
        (step) => step.phase === "depart" && step.kind !== "selfie",
      );
    }

    return EDL_PREMIUM_SEQUENCE.filter(
      (step) => step.phase === "arrivee" && step.kind !== "validation",
    );
  }, [type]);
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
  const [completing, setCompleting] = useState(false);
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
        // Stop immédiat — on n'avait besoin que d'initialiser le pipeline
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
  const completed = STEPS.filter(s => states[s.id]?.status === "success").length;
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

  // === Préchargement image exemple suivante (perf)
  useEffect(() => {
    const next = STEPS[safeIndex + 1];
    if (next?.example && typeof window !== "undefined") {
      const img = new Image();
      img.src = next.example;
    }
  }, [safeIndex, STEPS]);

  // === Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // === Inspection de la phase courante — créée à la première photo nécessaire
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

  // ─────────────────────────── HANDLERS ───────────────────────────
  const triggerCapture = () => fileRef.current?.click();

  const setState = (id: string, s: StepState) =>
    setStates(prev => ({ ...prev, [id]: s }));

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;

    const stepId = currentStep.id;
    let previewUrl: string | undefined;

    try {
      const stableFile = await prepareCapturedImage(raw);
      previewUrl = URL.createObjectURL(stableFile);
      setState(stepId, { status: "uploading", previewUrl });

      const insId = await ensureInspection();
      let compressed: File;
      try {
        compressed = await compressImage(stableFile);
      } catch {
        compressed = stableFile;
      }
      const path = `${userId}/${insId}/${stepId}.jpg`;
      await uploadWithRetry("inspection-photos", path, compressed);

      // Stratégie robuste : delete-then-insert (plus fiable que upsert sur certaines configs RLS)
      await supabase.from("inspection_photos")
        .delete()
        .eq("inspection_id", insId)
        .eq("vue_type", stepId);

      const { error: insertErr } = await supabase
        .from("inspection_photos")
        .insert({
          inspection_id: insId,
          vue_type: stepId,
          url_photo: path,
          file_size_bytes: compressed.size,
        });

      if (insertErr) {
        // Dernier recours : tente l'upsert si la contrainte unique existe
        const { error: upsertErr } = await supabase
          .from("inspection_photos")
          .upsert(
            { inspection_id: insId, vue_type: stepId, url_photo: path, file_size_bytes: compressed.size },
            { onConflict: "inspection_id,vue_type" },
          );
        if (upsertErr) throw upsertErr;
      }

      setState(stepId, {
        status: "success", previewUrl, storagePath: path,
        ocr: currentStep.kind === "scan" ? { status: "pending" } : undefined,
      });

      // OCR auto pour scans (PV livraison + carte grise) — non bloquant
      if (currentStep.kind === "scan") {
        supabase.functions.invoke("edl-document-ocr", {
          body: {
            storage_path: path,
            document_type: stepId,
            inspection_id: insId,
            attribution_id: attributionId,
            vue_type: stepId,
          },
        }).then(({ data, error }) => {
          if (error || !data) {
            console.warn("[EDL OCR]", error);
            setStates(prev => ({
              ...prev,
              [stepId]: { ...prev[stepId], ocr: { status: "failed", error: error?.message ?? "OCR indisponible" } },
            }));
            toast.warning("OCR indisponible", { description: "Document enregistré sans extraction." });
            return;
          }
          const fields = Object.entries((data.structured ?? {}) as Record<string, unknown>)
            .filter(([k, v]) => k !== "raw_text" && typeof v === "string" && v)
            .length;
          setStates(prev => ({
            ...prev,
            [stepId]: {
              ...prev[stepId],
              ocr: {
                status: "completed",
                classification: data.classification,
                fieldsCount: fields,
              },
            },
          }));
          if (fields > 0) {
            toast.success(`Scan OCR · ${fields} champ(s) extraits`, {
              description: `Classé : ${data.classification === "admin" ? "Admin" : data.classification === "client" ? "Client" : "Driver"}`,
            });
          }
        }).catch(e => {
          console.warn("[EDL OCR] invoke failed", e);
          setStates(prev => ({
            ...prev,
            [stepId]: { ...prev[stepId], ocr: { status: "failed", error: String(e) } },
          }));
        });
      }
    } catch (err) {
      console.error("[EDL Premium] photo upload failed", err);
      setState(stepId, {
        status: "error", previewUrl,
        error: err instanceof Error ? err.message : "Erreur réseau",
      });
      toast.error("Échec d'envoi", {
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
    let previewUrl = "";

    try {
      const stableFile = await prepareCapturedImage(raw);
      previewUrl = URL.createObjectURL(stableFile);
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
                  previewUrl: item.previewUrl || previewUrl,
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
    } catch (err) {
      console.error("[EDL Premium] signature failed", err);
      setState(stepId, {
        status: "error",
        error: err instanceof Error ? err.message : "Erreur",
      });
      toast.error("Signature échouée");
    }
  };

  const handleValidationStep = async () => {
    const stepId = currentStep.id;
    setState(stepId, { status: "uploading" });

    try {
      if (stepId === "send_admin") {
        // Marquer attribution comme prête pour validation admin
        await supabase.from("attributions")
          .update({ etape_courante: "en_validation_admin" })
          .eq("id", attributionId);
        await supabase.from("mission_etape_history").insert({
          attribution_id: attributionId,
          etape: "envoi_validation_admin",
          notes: "EDL complet, envoyé pour validation",
          created_by: userId,
        });
        setState(stepId, { status: "success" });
        toast.success("Envoyé à l'admin pour validation");
      } else if (stepId === "admin_validated") {
        // Cette étape attend la validation admin externe — elle ne se valide pas côté driver
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
    if (!inspectionId) {
      throw new Error("Inspection introuvable.");
    }

    const { error: inspectionError } = await supabase
      .from("inspections")
      .update({ statut: "complete" })
      .eq("id", inspectionId);

    if (inspectionError) throw inspectionError;

    if (type === "arrivee") {
      const [{ error: attributionError }, { error: historyError }] = await Promise.all([
        supabase.from("attributions")
          .update({ statut: "en_attente_validation", etape_courante: "en_attente_validation" })
          .eq("id", attributionId),
        supabase.from("mission_etape_history").insert({
          attribution_id: attributionId,
          etape: "envoi_validation_admin",
          notes: "EDL arrivée terminé, mission envoyée pour validation",
          created_by: userId,
        }),
      ]);

      if (attributionError || historyError) {
        throw attributionError ?? historyError;
      }
    }
  }, [attributionId, inspectionId, type, userId]);

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
    // La validation admin réelle s'enregistre dans attributions/etape_courante via send_admin (étape 25).
    if (currentStep.kind === "validation" && currentStep.id === "admin_validated") {
      return true;
    }
    if (isStepBypassed(currentStep)) return true;
    return s === "success";
  };

  const goNext = () => {
    if (!canAdvance()) {
      toast.error("Validez cette étape avant de continuer");
      return;
    }
    if (safeIndex < TOTAL - 1) {
      setStepIndex(safeIndex + 1);
    } else {
      setCompleting(true);
      void finalizeInspection()
        .then(() => {
          try { localStorage.removeItem(STORAGE_KEY(attributionId, type)); } catch { /* ignore */ }
          onComplete();
        })
        .catch((error) => {
          toast.error("Impossible de finaliser l'inspection", {
            description: error instanceof Error ? error.message : "Réessayez dans quelques secondes.",
          });
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

  const overlay = (
    <div className="edl-shell fixed inset-0 z-[100] flex flex-col">
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
          <img src={logoLigneo} alt="Ligneo" className="w-9 h-9 object-contain shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--edl-cyan)] font-bold truncate">
              {EDL_SECTION_LABEL[currentStep.section]}
            </p>
            <p className="text-sm font-semibold text-white truncate">
              Étape {currentStep.num}/{TOTAL}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-[var(--edl-text-soft)]">Avancement</p>
          <p className="text-sm font-bold text-white tabular-nums">{progressPct}%</p>
        </div>
      </header>

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
      <main className="flex-1 overflow-y-auto px-4 pb-32 pt-2">
        <div className="max-w-2xl mx-auto space-y-4">

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
                    {currentStep.num}/{TOTAL}
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
              onRetake={retake}
              onDelete={deleteCurrentPhoto}
            />
          )}

          {currentStep.kind === "selfie" && (
            <SelfieArea
              state={currentState}
              onCapture={triggerCapture}
              onRetake={retake}
              onDelete={deleteCurrentPhoto}
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
              onTrigger={handleValidationStep}
            />
          )}

        </div>

        {/* Input file caché — type adapté */}
        <input
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

      {/* === BARRE NAV STICKY BAS — toujours visible, mobile-first === */}
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
                Hors-ligne — reprise auto
              </span>
            )}
            <span className="text-white font-bold tabular-nums">
              Étape {currentStep.num}/{TOTAL}
            </span>
          </div>
        </div>
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
            disabled={!canAdvance()}
            className="edl-cta flex-1 h-12 px-4 flex items-center justify-center gap-2 disabled:opacity-50 text-sm font-semibold"
          >
            {safeIndex === TOTAL - 1
              ? "Terminer la mission"
              : currentStep.kind === "photo" || currentStep.kind === "scan"
                ? "Photo suivante"
                : "Étape suivante"}
            <ArrowRight size={18} />
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
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
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
  step, state, onCapture, onRetake, onDelete,
}: {
  step: EdlStepDef; state?: StepState; onCapture: () => void; onRetake: () => void; onDelete: () => void;
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
            className="w-full aspect-[3/2] object-cover"
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

      {/* Aperçu après prise */}
      {state?.previewUrl && (
        <div className="edl-photo-frame">
          <img
            src={state.previewUrl}
            alt="Votre prise"
            className="w-full aspect-[3/2] object-cover"
          />
          <div className="absolute top-3 right-3 z-10">
            {state.status === "uploading" && (
              <span className="edl-chip">
                <Loader2 size={11} className="animate-spin"/> Envoi…
              </span>
            )}
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
        <button
          onClick={onCapture}
          className="edl-cta w-full h-16 flex items-center justify-center gap-3 text-base"
        >
          {step.kind === "scan" ? <ScanLine size={22}/> : <Camera size={22}/>}
          {step.kind === "scan" ? "Scanner le document" : "Prendre la photo"}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onRetake}
            className="h-12 rounded-2xl edl-glass text-white font-semibold flex items-center justify-center gap-2"
          >
            <RefreshCw size={16}/> Reprendre
          </button>
          <button
            onClick={onDelete}
            className="h-12 rounded-2xl bg-red-500/15 border border-red-400/30 text-red-200 font-semibold flex items-center justify-center gap-2"
          >
            <X size={16}/> Supprimer
          </button>
        </div>
      )}

      {step.kind === "scan" && (
        <div className="edl-glass p-3 text-xs text-[var(--edl-text-soft)] flex items-start gap-2">
          <ScanLine size={14} className="text-[var(--edl-gold)] shrink-0 mt-0.5"/>
          <span>OCR + détection automatique des contours. Le document sera classé et transmis à l'admin.</span>
        </div>
      )}
    </div>
  );
}

function SelfieArea({
  state, onCapture, onRetake, onDelete,
}: { state?: StepState; onCapture: () => void; onRetake: () => void; onDelete: () => void }) {
  return (
    <div className="space-y-3">
      <div className="edl-glass p-5 text-center">
        <div className="mx-auto w-32 h-32 rounded-full edl-glass-strong flex items-center justify-center overflow-hidden">
          {state?.previewUrl ? (
            <img src={state.previewUrl} alt="Selfie" className="w-full h-full object-cover" />
          ) : (
            <UserCircle2 size={56} className="text-[var(--edl-cyan)]" />
          )}
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
        <button onClick={onCapture} className="edl-cta w-full h-16 flex items-center justify-center gap-3 text-base">
          <Camera size={22}/> Prendre le selfie
        </button>
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
        <div className="edl-glass p-4">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--edl-cyan)]">
            Nom du signataire
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nom et prénom"
            className="mt-2 w-full h-11 px-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/40 focus:border-[var(--edl-cyan)] focus:outline-none"
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
        <div className="edl-glass p-3">
          <SignatureCanvas onValidate={onSign} disabled={state?.status === "uploading"} />
        </div>
      )}
    </div>
  );
}

function ValidationArea({
  step, state, onTrigger,
}: { step: EdlStepDef; state?: StepState; onTrigger: () => void }) {
  const done = state?.status === "success";

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
          <h3 className="text-base font-bold text-white">Récap & envoi</h3>
          <p className="mt-1 text-sm text-[var(--edl-text-soft)]">
            Tout est complet : selfie, photos extérieur/intérieur, documents, signatures. Envoyez à l'admin pour validation finale.
          </p>
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
