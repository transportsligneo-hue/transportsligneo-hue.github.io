/**
 * EtatDesLieuxFlow — Parcours photo guidé "grand groupe" pour Transports Ligneo.
 *
 * RÈGLES STRICTES (NON NÉGOCIABLES) :
 *  - 1 étape = 1 photo
 *  - Ordre verrouillé (impossible à modifier)
 *  - Impossible de passer sans avoir pris la photo
 *  - Aucune sortie involontaire (confirmation avant fermeture)
 *  - Plein écran fixe, navigation 100% interne
 *
 * Branché sur le backend existant (table `inspections` + `inspection_photos`).
 * Aucune migration nécessaire — les `vue_type` réutilisent les IDs déjà connus
 * et ajoutent ceux qui manquaient (jante_*, roue_secours, kit_securite, pv_livraison,
 * carte_grise, cables).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, ArrowRight, Camera, Check, Loader2, X,
  RefreshCw, AlertCircle, ChevronRight, Eye, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";

interface Props {
  attributionId: string;
  type: "depart" | "arrivee";
  userId: string;
  onComplete: () => void;
  onClose: () => void;
}

type StepKind = "exterieur" | "interieur" | "coffre" | "tableau" | "securite" | "documents";

interface StepDef {
  /** ID stable utilisé en BDD (vue_type) */
  id: string;
  /** Numéro métier (1..20) — affiché dans l'UI */
  num: number;
  /** Section logique */
  section: StepKind;
  /** Libellé court */
  label: string;
  /** Sous-titre / description (consigne) */
  hint: string;
  /** Étape conditionnelle (câbles = EV/PHEV uniquement) */
  conditional?: "ev_only";
}

/**
 * ORDRE OBLIGATOIRE — défini par le métier.
 * NE PAS RÉORGANISER.
 */
const ALL_STEPS: StepDef[] = [
  // ───── EXTÉRIEUR ─────
  { num: 1,  id: "face_avant",                  section: "exterieur", label: "Face avant",              hint: "Photo de la face avant complète du véhicule" },
  { num: 2,  id: "trois_quart_avant_droite",    section: "exterieur", label: "Trois quarts avant",      hint: "Vue 3/4 avant droit du véhicule" },
  { num: 3,  id: "cote_droit",                  section: "exterieur", label: "Côté droit",              hint: "Vue de profil côté droit, véhicule entier" },
  { num: 4,  id: "jante_avant_droite",          section: "exterieur", label: "Jante avant droite",      hint: "Gros plan sur la jante avant droite" },
  { num: 5,  id: "trois_quart_arriere_droite",  section: "exterieur", label: "Trois quarts arrière droite", hint: "Vue 3/4 arrière droit" },
  { num: 6,  id: "jante_arriere_droite",        section: "exterieur", label: "Jante arrière droite",    hint: "Gros plan sur la jante arrière droite" },
  { num: 7,  id: "face_arriere",                section: "exterieur", label: "Face arrière",            hint: "Photo de la face arrière complète" },
  { num: 8,  id: "trois_quart_arriere_gauche",  section: "exterieur", label: "Trois quarts arrière gauche", hint: "Vue 3/4 arrière gauche" },
  { num: 9,  id: "jante_arriere_gauche",        section: "exterieur", label: "Jante arrière gauche",    hint: "Gros plan sur la jante arrière gauche" },
  { num: 10, id: "trois_quart_avant_gauche",    section: "exterieur", label: "Trois quarts avant gauche", hint: "Vue 3/4 avant gauche" },
  { num: 11, id: "jante_avant_gauche",          section: "exterieur", label: "Jante avant gauche",      hint: "Gros plan sur la jante avant gauche" },

  // ───── INTÉRIEUR ─────
  { num: 12, id: "siege_avant",                 section: "interieur", label: "Sièges avant",            hint: "Sièges conducteur + passager" },
  { num: 13, id: "siege_arriere",               section: "interieur", label: "Sièges arrière",          hint: "Banquette arrière + appuie-têtes" },

  // ───── COFFRE & ÉQUIPEMENTS ─────
  { num: 14, id: "coffre_ouvert",               section: "coffre",    label: "Coffre ouvert",           hint: "Coffre grand ouvert + intérieur" },
  { num: 15, id: "cables",                      section: "coffre",    label: "Câbles de recharge",      hint: "Photo des câbles de recharge", conditional: "ev_only" },
  { num: 16, id: "roue_secours",                section: "coffre",    label: "Roue de secours / kit",   hint: "Roue de secours OU kit anti-crevaison" },

  // ───── TABLEAU DE BORD ─────
  { num: 17, id: "compteur",                    section: "tableau",   label: "Compteur",                hint: "Carburant + kilométrage bien visibles" },

  // ───── SÉCURITÉ ─────
  { num: 18, id: "kit_securite",                section: "securite",  label: "Kit de sécurité",         hint: "Gilet jaune + triangle de signalisation" },

  // ───── DOCUMENTS ─────
  { num: 19, id: "pv_livraison",                section: "documents", label: "PV de livraison",         hint: "Photo du PV signé / bon de mission" },
  { num: 20, id: "carte_grise",                 section: "documents", label: "Carte grise",             hint: "Photo de la carte grise du véhicule" },
];

const SECTION_LABEL: Record<StepKind, string> = {
  exterieur: "Extérieur",
  interieur: "Intérieur",
  coffre: "Coffre & équipements",
  tableau: "Tableau de bord",
  securite: "Sécurité",
  documents: "Documents",
};

interface PhotoState {
  /** Chemin storage (ex: userId/inspId/face_avant.jpg) */
  storagePath?: string;
  /** URL d'aperçu (Blob local d'abord, puis URL signée après reload) */
  previewUrl?: string;
  /** Statut */
  status: "idle" | "uploading" | "success" | "error";
  /** Message d'erreur */
  error?: string;
}

interface StoredFlowState {
  attributionId: string;
  type: "depart" | "arrivee";
  stepIndex: number;
  inspectionId: string | null;
  photos: Record<string, PhotoState>;
  updatedAt: number;
}

const EV_FUEL = new Set(["electrique", "ev", "bev", "hybride_rechargeable", "phev"]);
const flowStorageKey = (attributionId: string, type: "depart" | "arrivee") => `edl:flow:${attributionId}:${type}`;

function isEvOrPhev(carb?: string | null) {
  if (!carb) return false;
  const n = carb.toLowerCase().trim().replace(/\s+/g, "_");
  return EV_FUEL.has(n) || n.includes("electr") || n.includes("rechargeable");
}

async function uploadWithRetry(path: string, file: File, attempts = 3) {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const { error } = await supabase.storage
        .from("inspection-photos")
        .upload(path, file, { upsert: true, contentType: "image/jpeg" });
      if (!error) return;
      lastErr = error;
    } catch (e) { lastErr = e; }
    await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  throw lastErr ?? new Error("Upload échoué");
}

export function EtatDesLieuxFlow({ attributionId, type, userId, onComplete, onClose }: Props) {
  const storageKey = useMemo(() => flowStorageKey(attributionId, type), [attributionId, type]);
  const initialState = useMemo<StoredFlowState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredFlowState;
      return parsed.attributionId === attributionId && parsed.type === type ? parsed : null;
    } catch { return null; }
  }, [attributionId, storageKey, type]);
  const [stepIndex, setStepIndex] = useState(() => initialState?.stepIndex ?? 0);
  const [showRecap, setShowRecap] = useState(false);
  const [photos, setPhotos] = useState<Record<string, PhotoState>>(() => initialState?.photos ?? {});
  const [inspectionId, setInspectionId] = useState<string | null>(() => initialState?.inspectionId ?? null);
  const [carburant, setCarburant] = useState<string | null>(null);
  const [vehicleLabel, setVehicleLabel] = useState<string>("");
  const [completing, setCompleting] = useState(false);
  const [askExit, setAskExit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const safePhotos = Object.fromEntries(
      Object.entries(photos).map(([key, value]) => [key, { ...value, previewUrl: value.previewUrl?.startsWith("blob:") ? undefined : value.previewUrl }]),
    ) as Record<string, PhotoState>;
    const raw = JSON.stringify({ attributionId, type, stepIndex, inspectionId, photos: safePhotos, updatedAt: Date.now() } satisfies StoredFlowState);
    sessionStorage.setItem(storageKey, raw);
    localStorage.setItem(storageKey, raw);
  }, [attributionId, inspectionId, photos, stepIndex, storageKey, type]);

  // Empêche la fermeture accidentelle (back système, refresh)
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(photos).length > 0 && !completing) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [photos, completing]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Filtre les étapes EV
  const STEPS = useMemo(() => {
    const ev = isEvOrPhev(carburant);
    return ALL_STEPS.filter(s => s.conditional !== "ev_only" || ev);
  }, [carburant]);

  const currentStep = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const currentPhoto = photos[currentStep.id];
  const totalSteps = STEPS.length;
  const completedCount = STEPS.filter(s => photos[s.id]?.status === "success").length;
  const progress = (completedCount / totalSteps) * 100;
  const allDone = completedCount === totalSteps;

  // Init inspection + restore existing photos
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
    ensureInspection().catch(e => {
      console.error("[EDL] ensureInspection failed", e);
      toast.error("Impossible d'initialiser l'état des lieux");
    });
  }, [ensureInspection]);

  // Charge infos véhicule (pour EV)
  useEffect(() => {
    (async () => {
      const { data: attr } = await supabase
        .from("attributions").select("trajet_id").eq("id", attributionId).maybeSingle();
      if (!attr?.trajet_id) return;
      const { data: t } = await supabase
        .from("trajets").select("marque, modele, immatriculation, demande_id")
        .eq("id", attr.trajet_id).maybeSingle();
      if (!t) return;
      setVehicleLabel([t.marque, t.modele, t.immatriculation].filter(Boolean).join(" · "));
      if (t.demande_id) {
        const { data: d } = await supabase
          .from("demandes_convoyage").select("carburant").eq("id", t.demande_id).maybeSingle();
        setCarburant(d?.carburant ?? null);
      }
    })();
  }, [attributionId]);

  // Restore photos déjà uploadées (en cas de reprise)
  useEffect(() => {
    if (!inspectionId) return;
    (async () => {
      const { data } = await supabase
        .from("inspection_photos")
        .select("vue_type, url_photo")
        .eq("inspection_id", inspectionId);
      if (!data) return;
      const next: Record<string, PhotoState> = {};
      for (const p of data) {
        const { data: signed } = await supabase.storage
          .from("inspection-photos").createSignedUrl(p.url_photo, 3600);
        next[p.vue_type] = {
          storagePath: p.url_photo,
          previewUrl: signed?.signedUrl,
          status: "success",
        };
      }
      setPhotos(prev => ({ ...next, ...prev }));
    })();
  }, [inspectionId]);

  // Trigger capture
  const triggerCapture = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;

    const stepId = currentStep.id;
    const previewUrl = URL.createObjectURL(raw);

    // Immédiat : aperçu local
    setPhotos(prev => ({
      ...prev,
      [stepId]: { previewUrl, status: "uploading" },
    }));

    try {
      const insId = await ensureInspection();
      const compressed = await compressImage(raw);
      const path = `${userId}/${insId}/${stepId}.jpg`;

      await uploadWithRetry(path, compressed);

      // Save row in DB (upsert sur (inspection_id, vue_type) — fallback select+update si la contrainte n'existe pas)
      const { error: upsertErr } = await supabase
        .from("inspection_photos")
        .upsert(
          { inspection_id: insId, vue_type: stepId, url_photo: path },
          { onConflict: "inspection_id,vue_type" },
        );

      if (upsertErr) {
        // Fallback : delete then insert
        await supabase.from("inspection_photos")
          .delete().eq("inspection_id", insId).eq("vue_type", stepId);
        await supabase.from("inspection_photos")
          .insert({ inspection_id: insId, vue_type: stepId, url_photo: path });
      }

      setPhotos(prev => ({
        ...prev,
        [stepId]: { storagePath: path, previewUrl, status: "success" },
      }));
    } catch (err) {
      console.error("[EDL] upload failed", err);
      setPhotos(prev => ({
        ...prev,
        [stepId]: {
          previewUrl,
          status: "error",
          error: err instanceof Error ? err.message : "Erreur réseau",
        },
      }));
      toast.error("Échec de l'envoi. Réessayez ou reprenez la photo.");
    }
  };

  const goNext = () => {
    if (currentPhoto?.status !== "success") {
      toast.error("Prenez d'abord la photo de cette étape");
      return;
    }
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      setShowRecap(true);
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const goToStep = (i: number) => {
    setStepIndex(i);
    setShowRecap(false);
  };

  const retake = () => {
    setPhotos(prev => {
      const next = { ...prev };
      delete next[currentStep.id];
      return next;
    });
  };

  const handleComplete = async () => {
    if (!allDone || !inspectionId) {
      toast.error("Toutes les photos doivent être prises");
      return;
    }
    setCompleting(true);
    try {
      await supabase.from("inspections")
        .update({ statut: "complete" })
        .eq("id", inspectionId);
      toast.success("État des lieux validé ✓");
      onComplete();
    } catch (err) {
      console.error("[EDL] complete failed", err);
      toast.error("Erreur lors de la validation");
      setCompleting(false);
    }
  };

  const requestExit = () => {
    if (Object.keys(photos).length === 0) {
      onClose();
    } else {
      setAskExit(true);
    }
  };

  /* ─────────────────── RECAP VIEW ─────────────────── */
  if (showRecap) {
    return (
      <FullScreen>
        <Header
          title="Récapitulatif"
          subtitle={`${type === "depart" ? "État des lieux départ" : "État des lieux arrivée"}`}
          right={<span className="text-emerald-700 text-sm font-semibold">{completedCount}/{totalSteps}</span>}
          onBack={() => setShowRecap(false)}
        />

        <div className="flex-1 overflow-auto px-4 py-4 bg-slate-50">
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  allDone ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {allDone ? <ShieldCheck size={22} /> : <AlertCircle size={22} />}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {allDone ? "Toutes les photos sont prises" : `${totalSteps - completedCount} photo(s) manquante(s)`}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {allDone ? "Vous pouvez valider l'état des lieux." : "Touchez une vignette pour la compléter."}
                  </p>
                </div>
              </div>
            </div>

            {/* Sections */}
            {(["exterieur", "interieur", "coffre", "tableau", "securite", "documents"] as StepKind[]).map(section => {
              const steps = STEPS.filter(s => s.section === section);
              if (steps.length === 0) return null;
              return (
                <div key={section}>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-1 mb-2">
                    {SECTION_LABEL[section]}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {steps.map(s => {
                      const p = photos[s.id];
                      const ok = p?.status === "success";
                      const idx = STEPS.findIndex(x => x.id === s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => goToStep(idx)}
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 text-left transition active:scale-[0.97] ${
                            ok
                              ? "border-emerald-300 bg-white"
                              : "border-dashed border-slate-300 bg-white hover:border-blue-400"
                          }`}
                        >
                          {p?.previewUrl ? (
                            <img src={p.previewUrl} alt={s.label} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                              <Camera size={22} />
                              <span className="text-[10px] mt-1 font-medium">À prendre</span>
                            </div>
                          )}
                          <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-white/95 text-slate-700 text-[11px] font-bold flex items-center justify-center shadow">
                            {s.num}
                          </div>
                          {ok && (
                            <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                              <Check size={13} strokeWidth={3} />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-1.5">
                            <p className="text-white text-[10px] font-medium truncate">{s.label}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <BottomBar>
          {!allDone ? (
            <button
              onClick={() => {
                const next = STEPS.findIndex(s => photos[s.id]?.status !== "success");
                if (next >= 0) goToStep(next);
              }}
              className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:scale-[0.98] transition"
            >
              <Camera size={18} />
              Compléter les photos manquantes
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-50"
            >
              {completing ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              Valider l'état des lieux
            </button>
          )}
        </BottomBar>

        {askExit && <ExitConfirm onCancel={() => setAskExit(false)} onConfirm={onClose} />}
      </FullScreen>
    );
  }

  /* ─────────────────── CAPTURE VIEW ─────────────────── */
  return (
    <FullScreen>
      <Header
        title={`${currentStep.num} / ${totalSteps}`}
        subtitle={type === "depart" ? "État des lieux — Départ" : "État des lieux — Arrivée"}
        right={
          completedCount > 0 && (
            <button
              onClick={() => setShowRecap(true)}
              className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center gap-1"
            >
              <Eye size={14} /> Récap
            </button>
          )
        }
        onBack={requestExit}
        backIcon={<X size={20} />}
      />

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Section pill */}
      <div className="px-4 pt-3 pb-1 bg-white">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
            {SECTION_LABEL[currentStep.section]}
          </span>
          {vehicleLabel && (
            <span className="text-[11px] text-slate-500 truncate">· {vehicleLabel}</span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="text-center mb-3">
            <h2 className="text-xl font-bold text-slate-900">{currentStep.label}</h2>
            <p className="text-slate-600 text-sm mt-1">{currentStep.hint}</p>
          </div>

          {/* Photo zone */}
          <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm aspect-[3/4] sm:aspect-[4/3]">
            {currentPhoto?.previewUrl ? (
              <>
                <img
                  src={currentPhoto.previewUrl}
                  alt={currentStep.label}
                  className="w-full h-full object-cover"
                />
                {currentPhoto.status === "uploading" && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="bg-white/90 rounded-full px-4 py-2 flex items-center gap-2">
                      <Loader2 className="animate-spin text-blue-600" size={16} />
                      <span className="text-xs text-slate-700 font-medium">Envoi en cours…</span>
                    </div>
                  </div>
                )}
                {currentPhoto.status === "success" && (
                  <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                    <Check size={18} strokeWidth={3} />
                  </div>
                )}
                {currentPhoto.status === "error" && (
                  <div className="absolute inset-x-3 bottom-3 bg-red-600 text-white rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span className="flex-1">Échec de l'envoi</span>
                    <button onClick={triggerCapture} className="underline font-semibold">Réessayer</button>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={triggerCapture}
                className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400 hover:bg-slate-50 transition active:scale-[0.99]"
              >
                <div className="w-20 h-20 rounded-full bg-blue-50 border-2 border-dashed border-blue-200 flex items-center justify-center">
                  <Camera size={32} className="text-blue-600" />
                </div>
                <p className="text-slate-700 text-sm font-semibold">Touchez pour ouvrir l'appareil photo</p>
                <p className="text-slate-400 text-xs">Étape {currentStep.num} sur {totalSteps}</p>
              </button>
            )}
          </div>

          {/* Status & actions inline */}
          {currentPhoto?.status === "success" && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={retake}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 active:scale-[0.98] transition"
              >
                <RefreshCw size={15} /> Reprendre
              </button>
            </div>
          )}

          {/* Mini stepper */}
          <div className="mt-5 flex items-center justify-center gap-1 flex-wrap max-w-md mx-auto">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goToStep(i)}
                aria-label={`Étape ${s.num}: ${s.label}`}
                className={`h-2 rounded-full transition-all ${
                  i === stepIndex ? "w-6 bg-blue-600" :
                  photos[s.id]?.status === "success" ? "w-2 bg-emerald-500" :
                  "w-2 bg-slate-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Hidden input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      {/* Bottom action bar */}
      <BottomBar>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={stepIndex === 0}
            className="px-4 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold disabled:opacity-30 active:scale-[0.97] transition flex items-center gap-1.5"
          >
            <ArrowLeft size={16} />
          </button>

          {currentPhoto?.status === "success" ? (
            <button
              onClick={goNext}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-wide text-sm hover:bg-emerald-700 active:scale-[0.98] transition"
            >
              {stepIndex === STEPS.length - 1 ? (
                <>Voir le récap <ChevronRight size={18} /></>
              ) : (
                <>Valider et continuer <ArrowRight size={18} /></>
              )}
            </button>
          ) : (
            <button
              onClick={triggerCapture}
              disabled={currentPhoto?.status === "uploading"}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wide text-sm hover:bg-blue-700 active:scale-[0.98] transition disabled:opacity-50"
            >
              {currentPhoto?.status === "uploading" ? (
                <><Loader2 className="animate-spin" size={18} /> Envoi…</>
              ) : (
                <><Camera size={18} /> Prendre la photo</>
              )}
            </button>
          )}
        </div>
      </BottomBar>

      {askExit && <ExitConfirm onCancel={() => setAskExit(false)} onConfirm={onClose} />}
    </FullScreen>
  );
}

/* ─────────────────── Sub-components ─────────────────── */

function FullScreen({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-white flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {children}
    </div>,
    document.body,
  );
}

function Header({
  title, subtitle, right, onBack, backIcon,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  backIcon?: React.ReactNode;
}) {
  return (
    <div className="bg-white border-b border-slate-200 px-3 py-2.5 flex items-center gap-2 shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition"
        >
          {backIcon ?? <ArrowLeft size={20} />}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium leading-tight">{subtitle}</p>
        <p className="text-slate-900 font-bold text-sm leading-tight truncate">{title}</p>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-white border-t border-slate-200 px-3 py-2.5 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
    >
      <div className="max-w-2xl mx-auto">{children}</div>
    </div>
  );
}

function ExitConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
          <h3 className="font-bold text-slate-900 text-base">Quitter l'état des lieux ?</h3>
        </div>
        <p className="text-slate-600 text-sm mb-4">
          Vos photos déjà prises sont sauvegardées. Vous pourrez reprendre là où vous en étiez.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 active:scale-[0.98] transition"
          >Continuer</button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 active:scale-[0.98] transition"
          >Quitter</button>
        </div>
      </div>
    </div>
  );
}
