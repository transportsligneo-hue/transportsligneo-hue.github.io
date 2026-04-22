/**
 * InspectionSequentielle — Parcours d'état des lieux séquentiel "grand groupe".
 *
 * ORDRE MÉTIER OBLIGATOIRE (UI uniquement — les `id` BDD restent stables) :
 *   1.  3/4 avant gauche
 *   2.  Jante avant gauche
 *   3.  Jante arrière gauche
 *   4.  3/4 arrière gauche
 *   5.  Arrière
 *   6.  Coffre (ouvert)
 *   7.  Roue de secours / kit crevaison
 *   8.  3/4 arrière droite
 *   9.  Jante arrière droite
 *   10. Sièges arrière
 *   11. Jante avant droite
 *   12. 3/4 avant droite
 *   13. Sièges avant
 *   14. Compteur (kilométrage + carburant)
 *   15. Kit sécurité
 *   16. PV livraison ou restitution
 *   17. Carte grise
 *   18. Signature sur téléphone (canvas tactile)
 *
 * Compatible 100% avec le backend existant :
 *   - Crée `inspections` (statut en_cours puis complete)
 *   - Stocke chaque photo dans `inspection_photos` (vue_type stable, multi-photos via timestamp)
 *   - Aucune migration DB nécessaire.
 *   - Commentaires stockés dans `inspection_photos.notes`.
 *   - L'étape "documents" délègue au composant <MissionDocuments> existant.
 *
 * UX :
 *   - Aperçu local immédiat (Blob URL)
 *   - Upload non bloquant en arrière-plan, retry x3
 *   - Statut visuel (uploading / success / error) par photo
 *   - Multi-photos par étape (sauf signature)
 *   - Signature : canvas tactile (pas de capture appareil photo)
 *   - Récap final cliquable
 *   - CTA principal fixé au-dessus de la bottom bar mobile
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Camera, Check, Loader2, X,
  Image as ImageIcon, AlertCircle, MessageSquare, ChevronRight,
  Send, PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { CarRealisticSilhouette } from "./CarRealisticSilhouette";
import { SignatureCanvas } from "./SignatureCanvas";
import frontGuide from "@/assets/inspection-guides/front.jpg";
import frontThreeQuarterGuide from "@/assets/inspection-guides/front-three-quarter.jpg";
import rearThreeQuarterGuide from "@/assets/inspection-guides/rear-three-quarter.jpg";
import rearGuide from "@/assets/inspection-guides/rear.jpg";
import openTrunkGuide from "@/assets/inspection-guides/open-trunk.jpg";

interface Props {
  attributionId: string;
  type: "depart" | "arrivee";
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Variant = Parameters<typeof CarRealisticSilhouette>[0]["variant"];

interface StepDef {
  /** Numéro affiché (1..N) */
  num: number;
  /** ID stable utilisé pour `vue_type` en BDD — ne JAMAIS changer */
  id: string;
  /** Libellé court (titre étape) */
  label: string;
  /** Sous-titre / description */
  hint: string;
  /** Variante de silhouette à afficher */
  variant: Variant;
  /** Étape conditionnelle (ex: câble = EV/PHEV uniquement) */
  conditional?: "ev_only";
  /** Si true, n'autorise qu'une seule photo (signature) */
  singlePhoto?: boolean;
  /** Étape spéciale */
  kind?: "photos" | "documents" | "signature";
}

interface GuideAsset {
  src: string;
  alt: string;
  mirror?: boolean;
}

/**
 * Liste maître. L'ORDRE est l'ORDRE MÉTIER affiché.
 * Les IDs (vue_type) restent compatibles avec ce qui est en base.
 *
 * IMPORTANT : ne pas renommer les `id` (clé `vue_type` dans la DB).
 * On peut ajouter de nouveaux IDs (jante_*, roue_secours, pv_livraison, carte_grise) :
 * ils seront enregistrés normalement et libellés côté admin.
 */
const ALL_STEPS: StepDef[] = [
  { num: 1,  id: "trois_quart_avant_gauche",   label: "3/4 avant gauche",       hint: "Vue 3/4 avant côté gauche",                variant: "trois_quart_avant_gauche" },
  { num: 2,  id: "jante_avant_gauche",         label: "Jante avant gauche",     hint: "Gros plan jante AV-G",                     variant: "jantes" },
  { num: 3,  id: "jante_arriere_gauche",       label: "Jante arrière gauche",   hint: "Gros plan jante AR-G",                     variant: "jantes" },
  { num: 4,  id: "trois_quart_arriere_gauche", label: "3/4 arrière gauche",     hint: "Vue 3/4 arrière côté gauche",              variant: "trois_quart_arriere_gauche" },
  { num: 5,  id: "arriere",                    label: "Arrière",                hint: "Vue arrière complète",                     variant: "coffre_ferme" },
  { num: 6,  id: "coffre_ouvert",              label: "Coffre ouvert",          hint: "Coffre grand ouvert + intérieur",          variant: "coffre_ouvert" },
  { num: 7,  id: "roue_secours",               label: "Roue de secours / kit",  hint: "Roue de secours OU kit anti-crevaison",    variant: "kit_securite" },
  { num: 8,  id: "trois_quart_arriere_droite", label: "3/4 arrière droite",     hint: "Vue 3/4 arrière côté droit",               variant: "trois_quart_arriere_droite" },
  { num: 9,  id: "jante_arriere_droite",       label: "Jante arrière droite",   hint: "Gros plan jante AR-D",                     variant: "jantes" },
  { num: 10, id: "siege_arriere",              label: "Sièges arrière",         hint: "Banquette + appuie-têtes",                 variant: "siege_arriere" },
  { num: 11, id: "jante_avant_droite",         label: "Jante avant droite",     hint: "Gros plan jante AV-D",                     variant: "jantes" },
  { num: 12, id: "trois_quart_avant_droite",   label: "3/4 avant droite",       hint: "Vue 3/4 avant côté droit",                 variant: "trois_quart_avant_droite" },
  { num: 13, id: "siege_avant",                label: "Sièges avant",           hint: "Sièges conducteur + passager",             variant: "siege_avant" },
  { num: 14, id: "compteur",                   label: "Compteur",               hint: "Kilométrage + niveau carburant",           variant: "compteur" },
  { num: 15, id: "kit_securite",               label: "Kit de sécurité",        hint: "Gilet jaune + triangle",                   variant: "kit_securite" },
  { num: 16, id: "pv_livraison",               label: "PV livraison / restitution", hint: "Photo du PV signé / bon de mission",   variant: "documents" },
  { num: 17, id: "carte_grise",                label: "Carte grise",            hint: "Photo de la carte grise du véhicule",      variant: "documents" },
  { num: 18, id: "signature",                  label: "Signature client",       hint: "Le client signe directement à l'écran",    variant: "signature", singlePhoto: true, kind: "signature" },
];

/**
 * Repères visuels (vraies photos de voiture) par variante.
 * Mappés indirectement via les nouveaux IDs d'étape ci-dessous (voir GUIDE_BY_STEP_ID).
 */
const STEP_GUIDE_IMAGES: Partial<Record<string, GuideAsset>> = {
  trois_quart_avant_gauche: {
    src: frontThreeQuarterGuide,
    alt: "Repère visuel véhicule en trois quarts avant gauche",
  },
  trois_quart_arriere_gauche: {
    src: rearThreeQuarterGuide,
    alt: "Repère visuel véhicule en trois quarts arrière gauche",
  },
  arriere: {
    src: rearGuide,
    alt: "Repère visuel véhicule vu de l'arrière",
  },
  coffre_ouvert: {
    src: openTrunkGuide,
    alt: "Repère visuel coffre ouvert",
  },
  trois_quart_arriere_droite: {
    src: rearThreeQuarterGuide,
    alt: "Repère visuel véhicule en trois quarts arrière droite",
    mirror: true,
  },
  trois_quart_avant_droite: {
    src: frontThreeQuarterGuide,
    alt: "Repère visuel véhicule en trois quarts avant droite",
    mirror: true,
  },
  // Vue avant — conservée pour anciennes inspections en base
  devant: {
    src: frontGuide,
    alt: "Repère visuel véhicule vu de face",
  },
};

interface PhotoEntry {
  localId: string;
  dbId?: string;
  previewUrl: string;
  storagePath?: string;
  status: "uploading" | "success" | "error";
  error?: string;
  comment?: string;
}

type PhotosByStep = Record<string, PhotoEntry[]>;

/* ─────────────────── Helpers ─────────────────── */

const EV_FUEL_VALUES = new Set([
  "electrique", "electric", "ev", "bev",
  "hybride_rechargeable", "phev", "plug-in", "plug_in_hybrid", "hybride-rechargeable",
]);

function isEvOrPhev(carburant?: string | null): boolean {
  if (!carburant) return false;
  const norm = carburant.toLowerCase().trim().replace(/\s+/g, "_");
  return EV_FUEL_VALUES.has(norm) || norm.includes("electr") || norm.includes("rechargeable");
}

async function uploadWithRetry(path: string, file: File, attempts = 3): Promise<void> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const { error } = await supabase.storage
        .from("inspection-photos")
        .upload(path, file, { upsert: true, contentType: "image/jpeg" });
      if (!error) return;
      lastErr = error;
      console.warn(`[inspection-seq] upload tentative ${i + 1} échec:`, error.message);
    } catch (e) {
      lastErr = e;
      console.warn(`[inspection-seq] upload tentative ${i + 1} exception:`, e);
    }
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  throw lastErr ?? new Error("Upload échoué");
}

/* ─────────────────── Composant ─────────────────── */

export function InspectionSequentielle({
  attributionId, type, userId, onComplete, onCancel,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [showRecap, setShowRecap] = useState(false);
  const [photos, setPhotos] = useState<PhotosByStep>({});
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState<{ marque?: string; modele?: string; immat?: string; carburant?: string }>({});
  const [editingComment, setEditingComment] = useState<{ stepId: string; localId: string; value: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const STEPS = useMemo(() => {
    const ev = isEvOrPhev(vehicleInfo.carburant);
    return ALL_STEPS
      .filter((s) => s.conditional !== "ev_only" || ev)
      .map((s, i) => ({ ...s, num: i + 1 }));
  }, [vehicleInfo.carburant]);

  const currentStep = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const currentPhotos = photos[currentStep.id] ?? [];
  const currentGuide = STEP_GUIDE_IMAGES[currentStep.variant];

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
      .select("id")
      .single();
    if (error) throw error;
    setInspectionId(data.id);
    return data.id;
  }, [attributionId, type, inspectionId]);

  useEffect(() => {
    ensureInspection().catch((e) => {
      console.error("[inspection-seq] ensureInspection failed:", e);
      toast.error("Impossible d'initialiser l'état des lieux");
    });
  }, [ensureInspection]);

  useEffect(() => {
    (async () => {
      const { data: attr } = await supabase
        .from("attributions").select("trajet_id").eq("id", attributionId).maybeSingle();
      if (!attr?.trajet_id) return;
      const { data: t } = await supabase
        .from("trajets")
        .select("marque, modele, immatriculation, demande_id")
        .eq("id", attr.trajet_id)
        .maybeSingle();
      if (!t) return;
      let carburant: string | null = null;
      if (t.demande_id) {
        const { data: d } = await supabase
          .from("demandes_convoyage")
          .select("carburant")
          .eq("id", t.demande_id)
          .maybeSingle();
        carburant = d?.carburant ?? null;
      }
      setVehicleInfo({
        marque: t.marque ?? undefined,
        modele: t.modele ?? undefined,
        immat: t.immatriculation ?? undefined,
        carburant: carburant ?? undefined,
      });
    })();
  }, [attributionId]);

  useEffect(() => {
    if (!inspectionId) return;
    (async () => {
      const { data } = await supabase
        .from("inspection_photos")
        .select("id, vue_type, url_photo, notes, created_at")
        .eq("inspection_id", inspectionId)
        .order("created_at", { ascending: true });
      if (!data) return;

      const next: PhotosByStep = {};
      for (const p of data) {
        const stepDef = ALL_STEPS.find((s) => p.vue_type === s.id || p.vue_type.startsWith(`${s.id}_`));
        if (!stepDef) continue;
        const { data: signed } = await supabase.storage
          .from("inspection-photos")
          .createSignedUrl(p.url_photo, 3600);
        const entry: PhotoEntry = {
          localId: p.id,
          dbId: p.id,
          previewUrl: signed?.signedUrl ?? p.url_photo,
          storagePath: p.url_photo,
          status: "success",
          comment: p.notes ?? undefined,
        };
        next[stepDef.id] = [...(next[stepDef.id] ?? []), entry];
      }
      if (Object.keys(next).length) setPhotos(next);
    })();
  }, [inspectionId]);

  const photoSteps = useMemo(() => STEPS.filter((s) => s.kind !== "documents"), [STEPS]);
  const completedPhotoSteps = useMemo(() => {
    return photoSteps.filter((s) => (photos[s.id]?.some((p) => p.status === "success") ?? false));
  }, [photos, photoSteps]);
  const completedSteps = useMemo(() => {
    return STEPS.filter((s) => {
      if (s.kind === "documents") return true;
      return (photos[s.id]?.some((p) => p.status === "success") ?? false);
    });
  }, [photos, STEPS]);
  const progressPct = Math.round((completedSteps.length / STEPS.length) * 100);

  const isJantes = currentStep.id === "jantes";
  const jantePhotosCount = isJantes ? (photos.jantes?.filter((p) => p.status !== "error").length ?? 0) : 0;
  const jantesRemaining = isJantes ? Math.max(0, 4 - jantePhotosCount) : 0;

  const triggerCamera = () => fileRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!raw) return;

    const localId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(raw);
    const stepId = currentStep.id;
    const isSingle = currentStep.singlePhoto === true;

    setPhotos((prev) => ({
      ...prev,
      [stepId]: isSingle
        ? [{ localId, previewUrl, status: "uploading" }]
        : [...(prev[stepId] ?? []), { localId, previewUrl, status: "uploading" }],
    }));

    void uploadOne(stepId, localId, raw);
  };

  const uploadOne = async (stepId: string, localId: string, raw: File) => {
    try {
      const insId = await ensureInspection();
      console.log("[inspection-seq] compress…", { step: stepId, size: raw.size });
      const file = await compressImage(raw);

      const stamp = Date.now();
      const path = `${userId}/${insId}/${stepId}_${stamp}.jpg`;

      console.log("[inspection-seq] upload storage:", path);
      await uploadWithRetry(path, file);

      console.log("[inspection-seq] insert DB row…");
      const { data: inserted, error: dbErr } = await supabase
        .from("inspection_photos")
        .insert({
          inspection_id: insId,
          vue_type: `${stepId}_${stamp}`,
          url_photo: path,
          file_size_bytes: file.size,
        })
        .select("id")
        .single();
      if (dbErr) throw dbErr;

      setPhotos((prev) => ({
        ...prev,
        [stepId]: (prev[stepId] ?? []).map((p) =>
          p.localId === localId
            ? { ...p, status: "success", storagePath: path, dbId: inserted.id }
            : p,
        ),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec d'envoi";
      console.error("[inspection-seq] upload error:", err);
      setPhotos((prev) => ({
        ...prev,
        [stepId]: (prev[stepId] ?? []).map((p) =>
          p.localId === localId ? { ...p, status: "error", error: msg } : p,
        ),
      }));
      toast.error("Échec d'envoi", { description: msg });
    }
  };

  const removePhoto = async (stepId: string, localId: string) => {
    const entry = photos[stepId]?.find((p) => p.localId === localId);
    setPhotos((prev) => ({
      ...prev,
      [stepId]: (prev[stepId] ?? []).filter((p) => p.localId !== localId),
    }));
    if (entry?.dbId) {
      await supabase.from("inspection_photos").delete().eq("id", entry.dbId);
    }
    if (entry?.storagePath) {
      await supabase.storage.from("inspection-photos").remove([entry.storagePath]);
    }
  };

  const saveComment = async () => {
    if (!editingComment) return;
    const { stepId, localId, value } = editingComment;
    setPhotos((prev) => ({
      ...prev,
      [stepId]: (prev[stepId] ?? []).map((p) =>
        p.localId === localId ? { ...p, comment: value } : p,
      ),
    }));
    const entry = photos[stepId]?.find((p) => p.localId === localId);
    if (entry?.dbId) {
      await supabase.from("inspection_photos").update({ notes: value }).eq("id", entry.dbId);
    }
    setEditingComment(null);
  };

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      setShowRecap(true);
    }
  };
  const goPrev = () => stepIndex > 0 && setStepIndex(stepIndex - 1);

  const handleComplete = async () => {
    if (!inspectionId) return;
    setCompleting(true);
    try {
      const summary = {
        steps_completed: completedSteps.length,
        steps_total: STEPS.length,
        photos_total: Object.values(photos).flat().filter((p) => p.status === "success").length,
        ev: isEvOrPhev(vehicleInfo.carburant),
      };
      const { error } = await supabase
        .from("inspections")
        .update({ statut: "complete", notes: JSON.stringify(summary) })
        .eq("id", inspectionId);
      if (error) throw error;
      toast.success("État des lieux validé");
      onComplete();
    } catch (e) {
      console.error("[inspection-seq] complete error:", e);
      toast.error("Impossible de clôturer l'état des lieux");
    } finally {
      setCompleting(false);
    }
  };

  if (showRecap) {
    const missingCritical = photoSteps.filter(
      (s) => !photos[s.id]?.some((p) => p.status === "success"),
    );

    return (
      <div className="fixed inset-0 z-[70] bg-pro-bg flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-pro-border shrink-0">
          <button onClick={() => setShowRecap(false)} className="p-2 -ml-2 hover:bg-pro-bg-soft rounded-lg" aria-label="Retour">
            <ArrowLeft size={20} className="text-pro-text-soft" />
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-pro-muted">Résumé de l'état des lieux</p>
            <p className="text-sm font-semibold text-pro-text">
              {completedPhotoSteps.length}/{photoSteps.length} étapes photo
            </p>
          </div>
          <span className="w-9" />
        </header>

        <div className="flex-1 overflow-auto px-4 py-4 pb-48">
          {missingCritical.length > 0 && (
            <div className="max-w-2xl mx-auto mb-4 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded-xl flex items-start gap-2">
              <AlertCircle size={16} className="text-primary shrink-0 mt-0.5" />
              <div className="text-pro-text text-xs">
                <p className="font-semibold">{missingCritical.length} étape(s) photo manquante(s)</p>
                <p className="opacity-80">Vous pouvez tout de même envoyer mais nous recommandons de les compléter.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 max-w-2xl mx-auto">
            {STEPS.map((s) => {
              if (s.kind === "documents") {
                return (
                  <button
                    key={s.id}
                    onClick={() => { setStepIndex(STEPS.indexOf(s)); setShowRecap(false); }}
                    className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary/25 bg-primary/10 hover:border-primary/40 transition flex flex-col items-center justify-center p-2"
                  >
                    <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-primary">
                      {s.num}
                    </span>
                    <FileText size={22} className="text-primary mb-1" />
                    <span className="text-[9px] text-center leading-tight font-medium text-pro-text">
                      Documents
                    </span>
                  </button>
                );
              }
              const ph = photos[s.id]?.find((p) => p.status === "success");
              const done = !!ph;
              return (
                <button
                  key={s.id}
                  onClick={() => { setStepIndex(STEPS.indexOf(s)); setShowRecap(false); }}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition ${
                    done ? "border-emerald-500 hover:border-emerald-600" : "border-pro-border bg-white hover:border-pro-text-soft"
                  }`}
                >
                  {done ? (
                    <>
                      <img src={ph.previewUrl} alt={s.label} className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-pro-muted">
                      <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-pro-bg-soft flex items-center justify-center text-[10px] font-bold">
                        {s.num}
                      </span>
                      <ImageIcon size={20} className="opacity-40 mb-1" />
                      <span className="text-[9px] text-center leading-tight">{s.label}</span>
                    </div>
                  )}
                  {done && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5">
                      <p className="text-white text-[9px] text-center truncate font-medium">{s.num}. {s.label}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <footer className="fixed inset-x-0 bottom-0 z-[80] border-t border-pro-border bg-white/95 backdrop-blur-sm shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.22)]">
          <div className="mx-auto w-full max-w-md px-4 pt-3 pb-4 safe-bottom">
            <button
              onClick={handleComplete}
              disabled={completing || completedPhotoSteps.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 transition shadow-lg shadow-emerald-600/20"
            >
              {completing ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              {completing ? "Envoi…" : "Envoyer l'état des lieux"}
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-pro-bg flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-pro-border shrink-0">
        <button onClick={onCancel} className="p-2 -ml-2 hover:bg-pro-bg-soft rounded-lg" aria-label="Fermer">
          <X size={20} className="text-pro-text-soft" />
        </button>
        <div className="text-center min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-pro-muted">
            État des lieux · {type === "depart" ? "Départ" : "Arrivée"}
          </p>
          <p className="text-sm font-semibold text-pro-text truncate">
            Étape {currentStep.num}/{STEPS.length}
          </p>
        </div>
        <button
          onClick={() => setShowRecap(true)}
          className="p-2 -mr-2 hover:bg-pro-bg-soft rounded-lg text-pro-text-soft"
          aria-label="Voir le résumé"
        >
          <ImageIcon size={18} />
        </button>
      </header>

      <div className="px-4 py-2.5 bg-white border-b border-pro-border shrink-0">
        <div className="h-1.5 bg-pro-bg-soft rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-pro-muted">
          <span>{completedSteps.length}/{STEPS.length} étapes</span>
          <span>{progressPct}%</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-md mx-auto px-4 py-4 space-y-4 pb-52">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow">
              {currentStep.num}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-pro-text font-bold text-lg leading-tight uppercase tracking-wide">
                {currentStep.label}
              </h2>
              <p className="text-pro-text-soft text-xs mt-0.5">
                {currentStep.hint}
              </p>
              {isJantes && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                  {jantePhotosCount}/4 jantes
                  {jantesRemaining > 0 && <span className="opacity-60">· {jantesRemaining} restantes</span>}
                </div>
              )}
            </div>
          </div>

          {currentStep.kind === "documents" ? (
            <div className="bg-white rounded-2xl border border-pro-border p-4 shadow-sm">
              <div className="flex items-start gap-2 mb-3 pb-3 border-b border-pro-border">
                <FileText size={18} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-pro-text text-sm font-semibold">Paquets & documents de la mission</p>
                  <p className="text-pro-text-soft text-xs mt-0.5">
                    Ajoutez la carte grise, le bon de prise en charge, le contrat, ou tout document fourni avec le véhicule.
                  </p>
                </div>
              </div>
              <MissionDocuments attributionId={attributionId} userId={userId} />
            </div>
          ) : (
            <>
              {currentPhotos.length === 0 ? (
                <div className="bg-white border border-pro-border rounded-2xl p-4 shadow-sm overflow-hidden">
                  {currentGuide ? (
                    <>
                      <div className="aspect-[4/3] overflow-hidden rounded-[18px] bg-pro-bg-soft border border-pro-border/70">
                        <img
                          src={currentGuide.src}
                          alt={currentGuide.alt}
                          loading="lazy"
                          width={1024}
                          height={768}
                          className="w-full h-full object-cover"
                          style={currentGuide.mirror ? { transform: "scaleX(-1)" } : undefined}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-pro-border pt-3">
                        <div>
                          <p className="text-pro-muted text-[10px] uppercase tracking-wider">Repère visuel</p>
                          <p className="text-pro-text text-sm font-semibold mt-0.5">Vraie vue véhicule</p>
                        </div>
                        {vehicleInfo.marque && (
                          <div className="text-right min-w-0">
                            <p className="text-pro-muted text-[10px] uppercase tracking-wider">Véhicule</p>
                            <p className="text-pro-text text-sm font-semibold truncate">
                              {[vehicleInfo.marque, vehicleInfo.modele].filter(Boolean).join(" ")}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="aspect-[4/3] flex items-center justify-center rounded-[18px] bg-pro-bg-soft border border-pro-border/70">
                        <CarRealisticSilhouette variant={currentStep.variant} className="max-w-[92%]" />
                      </div>
                      {vehicleInfo.marque && (
                        <div className="mt-3 pt-3 border-t border-pro-border text-center">
                          <p className="text-pro-muted text-[10px] uppercase tracking-wider">Véhicule</p>
                          <p className="text-pro-text text-sm font-semibold mt-0.5">
                            {[vehicleInfo.marque, vehicleInfo.modele].filter(Boolean).join(" ")}
                            {vehicleInfo.immat && <span className="text-pro-text-soft font-mono ml-2">· {vehicleInfo.immat}</span>}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {currentPhotos.map((p) => (
                    <div key={p.localId} className="bg-white border border-pro-border rounded-2xl overflow-hidden shadow-sm">
                      <div className="relative aspect-[4/3] bg-black">
                        <img src={p.previewUrl} alt={currentStep.label} className="w-full h-full object-cover" />
                        {p.status === "uploading" && (
                          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/70 text-white rounded-full text-[11px] backdrop-blur">
                            <Loader2 className="animate-spin" size={12} /> Envoi…
                          </div>
                        )}
                        {p.status === "success" && (
                          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[11px] shadow">
                            <Check size={12} strokeWidth={3} /> Envoyée
                          </div>
                        )}
                        {p.status === "error" && (
                          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white rounded-full text-[11px] max-w-[80%] shadow">
                            <AlertCircle size={12} /> {p.error ?? "Échec"}
                          </div>
                        )}
                        <button
                          onClick={() => removePhoto(currentStep.id, p.localId)}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur"
                          aria-label="Supprimer la photo"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="px-3 py-2 border-t border-pro-border">
                        {editingComment?.localId === p.localId ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editingComment.value}
                              onChange={(e) => setEditingComment({ ...editingComment, value: e.target.value })}
                              placeholder="Écrire un commentaire…"
                              className="flex-1 px-2 py-1.5 text-sm border border-pro-border rounded-lg focus:outline-none focus:border-emerald-500"
                              autoFocus
                            />
                            <button
                              onClick={saveComment}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                            >
                              OK
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingComment({ stepId: currentStep.id, localId: p.localId, value: p.comment ?? "" })}
                            className="flex items-center gap-2 text-pro-text-soft hover:text-pro-text text-xs w-full py-1"
                          >
                            <MessageSquare size={12} />
                            {p.comment ? <span className="text-left truncate">{p.comment}</span> : <span>Ajouter un commentaire (optionnel)</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-pro-border bg-white/95 backdrop-blur-sm shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.22)]">
        <div className="mx-auto w-full max-w-md px-4 pt-3 pb-4 safe-bottom space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />

          {currentStep.kind === "documents" ? (
            <button
              onClick={goNext}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98] transition shadow-sm"
            >
              Étape suivante <ChevronRight size={18} />
            </button>
          ) : currentPhotos.length === 0 ? (
            <button
              onClick={triggerCamera}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98] transition shadow-sm"
            >
              <Camera size={18} /> Prendre la photo
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={triggerCamera}
                className="flex items-center justify-center gap-1.5 py-3 bg-white border border-pro-border text-pro-text rounded-xl text-sm font-medium hover:bg-pro-bg-soft transition"
              >
                <Camera size={16} />
                {currentStep.singlePhoto ? "Reprendre" : "+ Photo"}
              </button>
              <button
                onClick={goNext}
                className="flex items-center justify-center gap-1.5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition"
              >
                {stepIndex === STEPS.length - 1 ? "Terminer" : "Valider"}
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={goPrev}
              disabled={stepIndex === 0}
              className="flex items-center gap-1 text-xs text-pro-text-soft hover:text-pro-text disabled:opacity-30 transition px-2 py-1"
            >
              <ArrowLeft size={12} /> Précédent
            </button>

            {currentPhotos.length === 0 && currentStep.kind !== "documents" && stepIndex < STEPS.length - 1 && (
              <button
                onClick={goNext}
                className="flex items-center gap-1 text-xs text-pro-muted hover:text-pro-text-soft transition px-2 py-1"
              >
                Passer <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
