/**
 * InspectionVisuelle — Nouveau parcours d'état des lieux visuel.
 *
 * Combine VehicleInspectionMap (silhouette interactive) + QuickCameraCapture
 * (appareil photo direct) dans un workflow ordonné selon la logique métier :
 *   1. Infos véhicule (rappel)
 *   2. Vue de dessus (carrosserie / pare-chocs)
 *   3. Vues latérales (portes, ailes, rétros)
 *   4. Intérieur (sièges, tableau de bord, coffre)
 *   5. Photos complémentaires libres
 *   6. Validation
 *
 * Compatible 100% avec le backend existant :
 *   - Crée une ligne dans `inspections` (statut = en_cours puis complete)
 *   - Stocke les photos dans `inspection_photos` avec vue_type = `zone_<id>`
 *   - Ne casse pas l'ancienne InspectionGuidee (utilisée en parallèle)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  VehicleInspectionMap,
  ZoneEvalModal,
  type VehicleView,
  type ZoneStatus,
} from "./VehicleInspectionMap";
import { QuickCameraCapture } from "./QuickCameraCapture";

interface Props {
  attributionId: string;
  type: "depart" | "arrivee";
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

type StepKey = "infos" | "top" | "sides" | "inside" | "extras" | "recap";

const STEPS: { key: StepKey; label: string; view?: VehicleView }[] = [
  { key: "infos", label: "Infos véhicule" },
  { key: "top", label: "Carrosserie (vue dessus)", view: "top" },
  { key: "sides", label: "Côtés & rétros", view: "sides" },
  { key: "inside", label: "Intérieur", view: "inside" },
  { key: "extras", label: "Photos complémentaires" },
  { key: "recap", label: "Validation" },
];

export function InspectionVisuelle({
  attributionId, type, userId, onComplete, onCancel,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [zones, setZones] = useState<Record<string, ZoneStatus>>({});
  const [activeZone, setActiveZone] = useState<{ id: string; label: string } | null>(null);
  const [cameraZone, setCameraZone] = useState<{ id: string; label: string } | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState<{ marque?: string; modele?: string; immat?: string }>({});

  const step = STEPS[stepIndex];

  // --- bootstrap : create / fetch inspection ---
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
    ensureInspection().catch(console.error);
  }, [ensureInspection]);

  // --- Vehicle info (display only) ---
  useEffect(() => {
    (async () => {
      const { data: attr } = await supabase
        .from("attributions")
        .select("trajet_id")
        .eq("id", attributionId)
        .maybeSingle();
      if (!attr?.trajet_id) return;
      const { data: t } = await supabase
        .from("trajets")
        .select("marque, modele, immatriculation")
        .eq("id", attr.trajet_id)
        .maybeSingle();
      if (t) setVehicleInfo({ marque: t.marque ?? undefined, modele: t.modele ?? undefined, immat: t.immatriculation ?? undefined });
    })();
  }, [attributionId]);

  // --- Hydrate from existing photos ---
  useEffect(() => {
    if (!inspectionId) return;
    (async () => {
      const { data } = await supabase
        .from("inspection_photos")
        .select("vue_type, url_photo")
        .eq("inspection_id", inspectionId);
      if (!data) return;
      const next: Record<string, ZoneStatus> = {};
      const extras: string[] = [];
      for (const p of data) {
        if (p.vue_type.startsWith("zone_")) {
          const zoneId = p.vue_type.replace("zone_", "");
          next[zoneId] = { state: "ok", photoUrl: p.url_photo };
        } else if (p.vue_type.startsWith("extra_")) {
          extras.push(p.url_photo);
        }
      }
      setZones(prev => ({ ...next, ...prev }));
      setExtraPhotos(extras);
    })();
  }, [inspectionId]);

  const counts = useMemo(() => {
    const arr = Object.values(zones);
    return {
      total: arr.length,
      ok: arr.filter(z => z.state === "ok").length,
      defaut: arr.filter(z => z.state === "defaut").length,
      a_verifier: arr.filter(z => z.state === "a_verifier").length,
      photos: arr.filter(z => !!z.photoUrl).length,
    };
  }, [zones]);

  const handleZoneClick = (zoneId: string, zoneLabel: string) => {
    setActiveZone({ id: zoneId, label: zoneLabel });
  };

  const handleZoneChange = (zoneId: string, status: ZoneStatus) => {
    setZones(prev => ({ ...prev, [zoneId]: status }));
  };

  const handleZonePhoto = (zoneId: string) => {
    if (!activeZone) return;
    setCameraZone({ id: zoneId, label: activeZone.label });
    setActiveZone(null);
  };

  const handleZonePhotoSaved = (storagePath: string) => {
    if (!cameraZone) return;
    setZones(prev => ({
      ...prev,
      [cameraZone.id]: {
        state: prev[cameraZone.id]?.state ?? "ok",
        comment: prev[cameraZone.id]?.comment,
        photoUrl: storagePath,
      },
    }));
  };

  const handleExtraPhoto = async (raw: File) => {
    if (!inspectionId) return;
    const path = `${userId}/${inspectionId}/extra_${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("inspection-photos")
      .upload(path, raw, { upsert: true, contentType: raw.type || "image/jpeg" });
    if (error) { console.error(error); return; }
    await supabase.from("inspection_photos").upsert({
      inspection_id: inspectionId,
      vue_type: `extra_${Date.now()}`,
      url_photo: path,
    });
    setExtraPhotos(prev => [...prev, path]);
  };

  const goNext = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  const goPrev = () => setStepIndex(i => Math.max(i - 1, 0));

  const handleComplete = async () => {
    if (!inspectionId) return;
    setCompleting(true);
    const note = JSON.stringify({ zones, extras: extraPhotos.length });
    await supabase.from("inspections")
      .update({ statut: "complete", notes: note })
      .eq("id", inspectionId);
    setCompleting(false);
    onComplete();
  };

  // ============== RENDER ==============

  return (
    <div className="fixed inset-0 z-50 bg-pro-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-pro-border shrink-0">
        <button onClick={onCancel} className="p-2 -ml-2 hover:bg-pro-bg-soft rounded-lg">
          <X size={20} className="text-pro-text-soft" />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-pro-muted">
            État des lieux {type === "depart" ? "départ" : "arrivée"}
          </p>
          <p className="text-sm font-semibold text-pro-text">{step.label}</p>
        </div>
        <span className="text-pro-muted text-xs w-10 text-right">
          {stepIndex + 1}/{STEPS.length}
        </span>
      </header>

      {/* Stepper */}
      <div className="px-4 py-2 bg-white border-b border-pro-border shrink-0">
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStepIndex(i)}
              className={`flex-1 h-1.5 rounded-full transition-all ${
                i < stepIndex ? "bg-emerald-500" :
                i === stepIndex ? "bg-emerald-600" : "bg-pro-bg-soft"
              }`}
              aria-label={s.label}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-pro-muted">
          <span>{counts.total} zones évaluées · {counts.photos} photos</span>
          {counts.defaut > 0 && (
            <span className="text-red-600 font-medium">{counts.defaut} défaut(s)</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {step.key === "infos" && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-white border border-pro-border rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-pro-muted mb-2">Véhicule contrôlé</p>
              <p className="text-pro-text text-lg font-semibold">
                {[vehicleInfo.marque, vehicleInfo.modele].filter(Boolean).join(" ") || "Véhicule"}
              </p>
              {vehicleInfo.immat && (
                <p className="text-pro-text-soft text-sm font-mono mt-1">{vehicleInfo.immat}</p>
              )}
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-emerald-900 text-sm font-medium mb-1">Comment ça marche ?</p>
              <ul className="text-emerald-800 text-xs space-y-1 list-disc pl-4">
                <li>Tapez sur chaque zone du véhicule pour la noter</li>
                <li>Ajoutez une photo et un commentaire si défaut</li>
                <li>Vous pouvez ajouter des photos libres en fin de parcours</li>
                <li>Validez à la fin pour clôturer l'état des lieux</li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <Legend color="emerald" label="OK" />
              <Legend color="red" label="Défaut" />
              <Legend color="amber" label="À vérifier" />
              <Legend color="slate" label="N/A" />
            </div>
          </div>
        )}

        {(step.key === "top" || step.key === "sides" || step.key === "inside") && step.view && (
          <div className="max-w-md mx-auto h-full">
            <div className="bg-white border border-pro-border rounded-2xl p-2 shadow-sm h-[60vh]">
              <VehicleInspectionMap
                view={step.view}
                zones={zones}
                onZoneClick={handleZoneClick}
              />
            </div>
            <p className="text-pro-muted text-xs text-center mt-3">
              👆 Tapez une zone pour la noter et ajouter une photo
            </p>
          </div>
        )}

        {step.key === "extras" && (
          <div className="max-w-md mx-auto space-y-3">
            <div className="bg-white border border-pro-border rounded-2xl p-5 shadow-sm">
              <p className="text-pro-text font-medium mb-1">Photos complémentaires</p>
              <p className="text-pro-text-soft text-xs mb-4">
                Ajoutez ici des photos libres : niveau carburant, intérieur du coffre, accessoires…
              </p>
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleExtraPhoto(f);
                    e.currentTarget.value = "";
                  }}
                  className="hidden"
                />
                <span className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition cursor-pointer">
                  <Camera size={18} /> Prendre une photo
                </span>
              </label>
            </div>

            {extraPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {extraPhotos.map((p, i) => (
                  <div key={i} className="aspect-square bg-pro-bg-soft rounded-lg flex items-center justify-center text-pro-muted text-xs">
                    Photo {i + 1}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step.key === "recap" && (
          <div className="max-w-md mx-auto space-y-3">
            <div className="bg-white border border-pro-border rounded-2xl p-5 shadow-sm">
              <p className="text-pro-text font-semibold mb-3">Récapitulatif</p>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Zones évaluées" value={counts.total} />
                <Stat label="Photos prises" value={counts.photos + extraPhotos.length} />
                <Stat label="Défauts" value={counts.defaut} tone={counts.defaut > 0 ? "red" : undefined} />
                <Stat label="À vérifier" value={counts.a_verifier} tone={counts.a_verifier > 0 ? "amber" : undefined} />
              </div>
            </div>

            {counts.defaut > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-900 text-sm font-medium mb-2">Défauts relevés</p>
                <ul className="space-y-1">
                  {Object.entries(zones)
                    .filter(([, s]) => s.state === "defaut")
                    .map(([id, s]) => (
                      <li key={id} className="text-red-800 text-xs">
                        • <span className="font-mono">{id}</span> {s.comment ? `— ${s.comment}` : ""}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
            >
              {completing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              {completing ? "Validation..." : "Valider l'état des lieux"}
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <footer className="px-4 py-3 bg-white border-t border-pro-border flex items-center gap-2 shrink-0 safe-bottom">
        <button
          onClick={goPrev}
          disabled={stepIndex === 0}
          className="px-4 py-2.5 rounded-xl bg-pro-bg-soft text-pro-text-soft text-sm font-medium disabled:opacity-30 flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Précédent
        </button>
        <button
          onClick={goNext}
          disabled={stepIndex === STEPS.length - 1}
          className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-30 flex items-center justify-center gap-1 hover:bg-emerald-700"
        >
          Suivant <ArrowRight size={14} />
        </button>
      </footer>

      {/* Zone modal */}
      {activeZone && (
        <ZoneEvalModal
          zoneId={activeZone.id}
          zoneLabel={activeZone.label}
          current={zones[activeZone.id]}
          onChange={handleZoneChange}
          onClose={() => setActiveZone(null)}
          onPhoto={handleZonePhoto}
        />
      )}

      {/* Camera */}
      {cameraZone && inspectionId && (
        <QuickCameraCapture
          inspectionId={inspectionId}
          userId={userId}
          zoneId={cameraZone.id}
          zoneLabel={cameraZone.label}
          existingUrl={zones[cameraZone.id]?.photoUrl}
          onCaptured={handleZonePhotoSaved}
          onClose={() => setCameraZone(null)}
        />
      )}
    </div>
  );
}

function Legend({ color, label }: { color: "emerald" | "red" | "amber" | "slate"; label: string }) {
  const map = {
    emerald: "bg-emerald-100 border-emerald-300 text-emerald-800",
    red: "bg-red-100 border-red-300 text-red-800",
    amber: "bg-amber-100 border-amber-300 text-amber-800",
    slate: "bg-slate-100 border-slate-300 text-slate-700",
  };
  return (
    <div className={`px-3 py-2 rounded-lg border text-xs font-medium ${map[color]}`}>{label}</div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "red" | "amber" }) {
  const color = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-pro-text";
  return (
    <div className="bg-pro-bg-soft rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-pro-muted">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}
