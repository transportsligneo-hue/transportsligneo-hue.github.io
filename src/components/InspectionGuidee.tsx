import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, RotateCcw, ArrowRight, Check, Loader2, X } from "lucide-react";

const VUE_TYPES = [
  { id: "avant", label: "Avant", description: "Face avant du véhicule" },
  { id: "avant_droit", label: "Avant droit 3/4", description: "Vue 3/4 avant droite" },
  { id: "cote_droit", label: "Côté droit", description: "Profil droit complet" },
  { id: "arriere_droit", label: "Arrière droit 3/4", description: "Vue 3/4 arrière droite" },
  { id: "arriere", label: "Arrière", description: "Face arrière du véhicule" },
  { id: "arriere_gauche", label: "Arrière gauche 3/4", description: "Vue 3/4 arrière gauche" },
  { id: "cote_gauche", label: "Côté gauche", description: "Profil gauche complet" },
  { id: "avant_gauche", label: "Avant gauche 3/4", description: "Vue 3/4 avant gauche" },
  { id: "interieur_avant", label: "Intérieur avant", description: "Sièges avant et planche de bord" },
  { id: "interieur_arriere", label: "Intérieur arrière", description: "Sièges arrière et coffre" },
  { id: "tableau_bord", label: "Tableau de bord", description: "Compteur kilométrique" },
] as const;

interface InspectionGuideeProps {
  attributionId: string;
  type: "depart" | "arrivee";
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function InspectionGuidee({ attributionId, type, userId, onComplete, onCancel }: InspectionGuideeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentVue = VUE_TYPES[currentStep];
  const progress = Object.keys(photos).length / VUE_TYPES.length * 100;
  const allPhotosComplete = Object.keys(photos).length === VUE_TYPES.length;

  const ensureInspection = useCallback(async () => {
    if (inspectionId) return inspectionId;
    const { data, error } = await supabase.from("inspections").insert({
      attribution_id: attributionId,
      type,
      statut: "en_cours",
    }).select("id").single();
    if (error) {
      // Maybe already exists
      const { data: existing } = await supabase.from("inspections")
        .select("id").eq("attribution_id", attributionId).eq("type", type).single();
      if (existing) { setInspectionId(existing.id); return existing.id; }
      throw error;
    }
    setInspectionId(data.id);
    return data.id;
  }, [attributionId, type, inspectionId]);

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentVue) return;

    setUploading(true);
    try {
      const insId = await ensureInspection();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${insId}/${currentVue.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("inspection-photos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("inspection-photos")
        .getPublicUrl(path);

      // Save to DB (upsert for retakes)
      await supabase.from("inspection_photos").upsert({
        inspection_id: insId,
        vue_type: currentVue.id,
        url_photo: urlData.publicUrl,
      }, { onConflict: "inspection_id,vue_type" });

      setPhotos((prev) => ({ ...prev, [currentVue.id]: URL.createObjectURL(file) }));
    } catch (err) {
      console.error("Upload error:", err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRetake = () => {
    const { [currentVue.id]: _, ...rest } = photos;
    setPhotos(rest);
  };

  const handleNext = () => {
    if (currentStep < VUE_TYPES.length - 1) setCurrentStep(currentStep + 1);
  };

  const handleComplete = async () => {
    if (!inspectionId) return;
    setCompleting(true);
    await supabase.from("inspections").update({ statut: "complete" }).eq("id", inspectionId);
    setCompleting(false);
    onComplete();
  };

  const hasCurrentPhoto = !!photos[currentVue.id];

  return (
    <div className="fixed inset-0 z-50 bg-navy flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-navy-light border-b border-primary/20">
        <button onClick={onCancel} className="text-cream/50 hover:text-cream">
          <X size={20} />
        </button>
        <h2 className="font-heading text-sm text-primary uppercase tracking-wider">
          État des lieux {type === "depart" ? "départ" : "arrivée"}
        </h2>
        <span className="text-cream/50 text-xs">{currentStep + 1}/{VUE_TYPES.length}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-navy-light">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 overflow-auto">
        {/* Photo area */}
        <div className="w-full max-w-sm aspect-[3/4] relative rounded-lg overflow-hidden border-2 border-primary/30 bg-navy-light mb-6">
          {hasCurrentPhoto ? (
            <img src={photos[currentVue.id]} alt={currentVue.label} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
              {/* Overlay guide silhouette */}
              <div className="w-32 h-32 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center mb-4">
                <Camera size={32} className="text-primary/40" />
              </div>
              <p className="font-heading text-primary text-lg">{currentVue.label}</p>
              <p className="text-cream/40 text-xs mt-1">{currentVue.description}</p>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-navy/80 flex items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          )}
        </div>

        {/* Vue label */}
        <p className="font-heading text-primary text-base mb-1">{currentVue.label}</p>
        <p className="text-cream/40 text-xs mb-6">{currentVue.description}</p>

        {/* Step dots */}
        <div className="flex gap-1.5 mb-6 flex-wrap justify-center max-w-xs">
          {VUE_TYPES.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setCurrentStep(i)}
              className={`w-3 h-3 rounded-full transition-all ${
                i === currentStep ? "bg-primary scale-125" :
                photos[v.id] ? "bg-green-500" : "bg-cream/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-4 bg-navy-light border-t border-primary/20 space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {!hasCurrentPhoto ? (
          <button
            onClick={handleCapture}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-wider uppercase disabled:opacity-50"
          >
            <Camera size={18} /> Prendre la photo
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleRetake}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-primary/30 text-primary text-sm rounded"
            >
              <RotateCcw size={16} /> Reprendre
            </button>
            {currentStep < VUE_TYPES.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-wider uppercase"
              >
                Suivant <ArrowRight size={16} />
              </button>
            ) : allPhotosComplete ? (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-heading text-sm tracking-wider uppercase disabled:opacity-50"
              >
                {completing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                Valider
              </button>
            ) : (
              <button
                onClick={() => {
                  const nextMissing = VUE_TYPES.findIndex((v) => !photos[v.id]);
                  if (nextMissing >= 0) setCurrentStep(nextMissing);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-wider uppercase"
              >
                Photo manquante <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
