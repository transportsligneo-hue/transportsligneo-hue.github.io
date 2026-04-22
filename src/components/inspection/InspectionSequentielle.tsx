/**
 * InspectionSequentielle — Parcours d'état des lieux 15 étapes (style "grand groupe").
 *
 * Suit STRICTEMENT l'ordre métier demandé :
 *  1. Devant
 *  2. 3/4 gauche avant
 *  3. 3/4 gauche arrière
 *  4. Arrière
 *  5. Coffre ouvert
 *  6. Sièges arrière
 *  7. Sièges avant
 *  8. 3/4 droite arrière
 *  9. 3/4 droite avant
 *  10. Compteur (km + carburant)
 *  11. Câble de recharge (optionnel — électrique/hybride)
 *  12. Roue de secours / kit crevaison
 *  13. Kit sécurité (gilet + triangle)
 *  14. PV livraison / restitution
 *  15. Signature
 *
 * Compatible 100% avec le backend existant :
 *   - Crée `inspections` (statut en_cours puis complete)
 *   - Stocke chaque photo dans `inspection_photos` (vue_type stable, multi-photos via timestamp)
 *   - Aucune migration DB nécessaire (la contrainte CHECK a déjà été supprimée).
 *   - Commentaires stockés dans `inspection_photos.notes`.
 *
 * UX :
 *   - Aperçu local immédiat (Blob URL)
 *   - Upload non bloquant en arrière-plan, retry x3
 *   - Statut visuel (uploading / success / error) par photo
 *   - Reprendre / Valider / Commentaire optionnel
 *   - Multi-photos par étape (sauf signature)
 *   - Récap final cliquable
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Camera, Check, Loader2, X,
  Image as ImageIcon, AlertCircle, MessageSquare, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { CarRealisticSilhouette } from "./CarRealisticSilhouette";

interface Props {
  attributionId: string;
  type: "depart" | "arrivee";
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Variant = Parameters<typeof CarRealisticSilhouette>[0]["variant"];

interface StepDef {
  /** Numéro affiché (1..15) */
  num: number;
  /** ID stable utilisé pour `vue_type` en BDD — ne JAMAIS changer */
  id: string;
  /** Libellé court (titre étape) */
  label: string;
  /** Sous-titre / description */
  hint: string;
  /** Variante de silhouette à afficher */
  variant: Variant;
  /** Étape optionnelle (peut être skippée) */
  optional?: boolean;
  /** Si true, n'autorise qu'une seule photo (signature) */
  singlePhoto?: boolean;
}

const STEPS: StepDef[] = [
  { num: 1,  id: "devant",                      label: "Devant",                  hint: "Vue de face complète",          variant: "devant" },
  { num: 2,  id: "trois_quart_avant_gauche",    label: "3/4 avant gauche",        hint: "Vue 3/4 avant côté gauche",     variant: "trois_quart_avant_gauche" },
  { num: 3,  id: "trois_quart_arriere_gauche",  label: "3/4 arrière gauche",      hint: "Vue 3/4 arrière côté gauche",   variant: "trois_quart_arriere_gauche" },
  { num: 4,  id: "arriere",                     label: "Arrière",                 hint: "Vue arrière complète",          variant: "arriere" },
  { num: 5,  id: "coffre_ouvert",               label: "Coffre ouvert",           hint: "Coffre grand ouvert",           variant: "coffre_ouvert" },
  { num: 6,  id: "siege_arriere",               label: "Siège arrière",           hint: "Banquette arrière",             variant: "siege_arriere" },
  { num: 7,  id: "siege_avant",                 label: "Siège avant",             hint: "Sièges avant",                  variant: "siege_avant" },
  { num: 8,  id: "trois_quart_arriere_droite",  label: "3/4 arrière droite",      hint: "Vue 3/4 arrière côté droit",    variant: "trois_quart_arriere_droite" },
  { num: 9,  id: "trois_quart_avant_droite",    label: "3/4 avant droite",        hint: "Vue 3/4 avant côté droit",      variant: "trois_quart_avant_droite" },
  { num: 10, id: "compteur",                    label: "Compteur",                hint: "Kilométrage + niveau carburant", variant: "compteur" },
  { num: 11, id: "cable",                       label: "Câble de recharge",      hint: "Si électrique / hybride rechargeable", variant: "cable", optional: true },
  { num: 12, id: "roue_secours",                label: "Roue de secours",         hint: "Roue de secours ou kit crevaison", variant: "roue_secours" },
  { num: 13, id: "kit_securite",                label: "Kit sécurité",            hint: "Gilet + triangle",              variant: "kit_securite" },
  { num: 14, id: "pv_livraison",                label: "PV livraison",            hint: "PV livraison ou restitution",   variant: "pv_livraison" },
  { num: 15, id: "signature",                   label: "Signature",               hint: "Signature client",              variant: "signature", singlePhoto: true },
];

interface PhotoEntry {
  /** UUID local pour réconcilier (même avant insertion DB) */
  localId: string;
  /** ID DB (inspection_photos.id) une fois inséré */
  dbId?: string;
  /** Aperçu (URL.createObjectURL) ou chemin Storage si déjà uploadé */
  previewUrl: string;
  /** Chemin Storage final */
  storagePath?: string;
  /** Statut upload */
  status: "uploading" | "success" | "error";
  /** Message d'erreur éventuel */
  error?: string;
  /** Commentaire optionnel */
  comment?: string;
}

type PhotosByStep = Record<string, PhotoEntry[]>;

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

export function InspectionSequentielle({
  attributionId, type, userId, onComplete, onCancel,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [showRecap, setShowRecap] = useState(false);
  const [photos, setPhotos] = useState<PhotosByStep>({});
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState<{ marque?: string; modele?: string; immat?: string }>({});
  const [editingComment, setEditingComment] = useState<{ stepId: string; localId: string; value: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentStep = STEPS[stepIndex];
  const currentPhotos = photos[currentStep.id] ?? [];

  // ─── bootstrap inspection ───
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

  // ─── infos véhicule ───
  useEffect(() => {
    (async () => {
      const { data: attr } = await supabase
        .from("attributions").select("trajet_id").eq("id", attributionId).maybeSingle();
      if (!attr?.trajet_id) return;
      const { data: t } = await supabase
        .from("trajets").select("marque, modele, immatriculation").eq("id", attr.trajet_id).maybeSingle();
      if (t) setVehicleInfo({
        marque: t.marque ?? undefined,
        modele: t.modele ?? undefined,
        immat: t.immatriculation ?? undefined,
      });
    })();
  }, [attributionId]);

  // ─── hydrate from existing photos ───
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
        // Gérer les anciens vue_type (legacy "zone_xxx" ou exact step.id) et les nouveaux (step.id ou step.id_<ts>)
        const stepDef = STEPS.find((s) => p.vue_type === s.id || p.vue_type.startsWith(`${s.id}_`));
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

  // ─── progression ───
  const completedSteps = useMemo(() => {
    return STEPS.filter((s) => (photos[s.id]?.some((p) => p.status === "success") ?? false));
  }, [photos]);
  const progressPct = Math.round((completedSteps.length / STEPS.length) * 100);

  // ─── prise de photo ───
  const triggerCamera = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!raw) return;

    const localId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(raw);
    const stepId = currentStep.id;

    // Si étape signature → remplace la photo existante
    const isSingle = currentStep.singlePhoto === true;
    setPhotos((prev) => ({
      ...prev,
      [stepId]: isSingle
        ? [{ localId, previewUrl, status: "uploading" }]
        : [...(prev[stepId] ?? []), { localId, previewUrl, status: "uploading" }],
    }));

    // Upload non bloquant
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

  const retryPhoto = async (stepId: string, localId: string) => {
    // Pour un retry, on relance simplement la prise de photo (le fichier brut a été perdu).
    // L'utilisateur reprend la photo via "Reprendre".
    toast.info("Tapez « Reprendre » pour refaire la photo");
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

  // ─── navigation ───
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

  // ============== RENDER : RÉCAP ==============
  if (showRecap) {
    return (
      <div className="fixed inset-0 z-50 bg-pro-bg flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-pro-border shrink-0">
          <button onClick={() => setShowRecap(false)} className="p-2 -ml-2 hover:bg-pro-bg-soft rounded-lg">
            <ArrowLeft size={20} className="text-pro-text-soft" />
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-pro-muted">Résumé des photos</p>
            <p className="text-sm font-semibold text-pro-text">
              {completedSteps.length}/{STEPS.length} étapes complétées
            </p>
          </div>
          <span className="w-9" />
        </header>

        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-2 max-w-2xl mx-auto">
            {STEPS.map((s) => {
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
                      <img src={ph!.previewUrl} alt={s.label} className="w-full h-full object-cover" />
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

        <footer className="px-4 py-4 bg-white border-t border-pro-border shrink-0 safe-bottom">
          <button
            onClick={handleComplete}
            disabled={completing || completedSteps.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 transition"
          >
            {completing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
            {completing ? "Validation…" : "Valider l'état des lieux"}
          </button>
        </footer>
      </div>
    );
  }

  // ============== RENDER : ÉTAPE ==============
  return (
    <div className="fixed inset-0 z-50 bg-pro-bg flex flex-col">
      {/* Header */}
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

      {/* Progression */}
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

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-md mx-auto px-4 py-4 space-y-4">
          {/* Titre étape */}
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
                {currentStep.optional && <span className="ml-1 text-amber-600">· optionnel</span>}
              </p>
            </div>
          </div>

          {/* Carte silhouette / aperçu */}
          {currentPhotos.length === 0 ? (
            <div className="bg-white border border-pro-border rounded-2xl p-6 shadow-sm">
              <div className="aspect-[4/3] flex items-center justify-center">
                <CarRealisticSilhouette variant={currentStep.variant} />
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
            </div>
          ) : (
            <div className="space-y-2">
              {currentPhotos.map((p) => (
                <div key={p.localId} className="bg-white border border-pro-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="relative aspect-[4/3] bg-black">
                    <img src={p.previewUrl} alt={currentStep.label} className="w-full h-full object-cover" />
                    {/* Statut */}
                    {p.status === "uploading" && (
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/70 text-white rounded-full text-[11px] backdrop-blur">
                        <Loader2 className="animate-spin" size={12} /> Envoi…
                      </div>
                    )}
                    {p.status === "success" && (
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[11px] shadow">
                        <Check size={12} strokeWidth={3} /> Photo prise
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
                  {/* Commentaire */}
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
        </div>
      </div>

      {/* Action photo */}
      <div className="px-4 py-3 bg-white border-t border-pro-border shrink-0 space-y-2 safe-bottom">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />

        {currentPhotos.length === 0 ? (
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

        {/* Navigation secondaire */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={goPrev}
            disabled={stepIndex === 0}
            className="flex items-center gap-1 text-xs text-pro-text-soft hover:text-pro-text disabled:opacity-30 transition px-2 py-1"
          >
            <ArrowLeft size={12} /> Précédent
          </button>

          {currentPhotos.length === 0 && currentStep.optional && (
            <button
              onClick={goNext}
              className="flex items-center gap-1 text-xs text-pro-text-soft hover:text-pro-text transition px-2 py-1"
            >
              Passer (non concerné) <ArrowRight size={12} />
            </button>
          )}

          {currentPhotos.length === 0 && !currentStep.optional && stepIndex < STEPS.length - 1 && (
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
  );
}
