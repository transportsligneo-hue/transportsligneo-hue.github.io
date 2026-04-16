import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, RotateCcw, ArrowRight, Check, Loader2, X, ArrowLeft, Eye } from "lucide-react";

const VUE_TYPES = [
  { id: "avant", label: "Avant", description: "Face avant du véhicule" },
  { id: "avant_gauche", label: "3/4 avant gauche", description: "Vue 3/4 avant gauche" },
  { id: "avant_droit", label: "3/4 avant droite", description: "Vue 3/4 avant droite" },
  { id: "arriere", label: "Arrière", description: "Face arrière du véhicule" },
  { id: "arriere_gauche", label: "3/4 arrière gauche", description: "Vue 3/4 arrière gauche" },
  { id: "arriere_droit", label: "3/4 arrière droite", description: "Vue 3/4 arrière droite" },
  { id: "compteur", label: "Compteur", description: "Compteur kilométrique" },
  { id: "siege_avant", label: "Siège avant", description: "Sièges avant" },
  { id: "siege_arriere", label: "Siège arrière", description: "Sièges arrière" },
  { id: "coffre", label: "Coffre", description: "Intérieur du coffre" },
] as const;

interface InspectionGuideeProps {
  attributionId: string;
  type: "depart" | "arrivee";
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

type ViewMode = "capture" | "recap";

export function InspectionGuidee({ attributionId, type, userId, onComplete, onCancel }: InspectionGuideeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("capture");
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentVue = VUE_TYPES[currentStep];
  const progress = Object.keys(photos).length / VUE_TYPES.length * 100;
  const allPhotosComplete = Object.keys(photos).length === VUE_TYPES.length;
  const missingPhotos = VUE_TYPES.filter((v) => !photos[v.id]);

  const ensureInspection = useCallback(async () => {
    if (inspectionId) return inspectionId;
    const { data, error } = await supabase.from("inspections").insert({
      attribution_id: attributionId,
      type,
      statut: "en_cours",
    }).select("id").single();
    if (error) {
      const { data: existing } = await supabase.from("inspections")
        .select("id").eq("attribution_id", attributionId).eq("type", type).single();
      if (existing) { setInspectionId(existing.id); return existing.id; }
      throw error;
    }
    setInspectionId(data.id);
    return data.id;
  }, [attributionId, type, inspectionId]);

  const animateStep = (newStep: number) => {
    const direction = newStep > currentStep ? "right" : "left";
    setSlideDirection(direction);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(newStep);
      setIsTransitioning(false);
    }, 200);
  };

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
    if (currentStep < VUE_TYPES.length - 1) animateStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 0) animateStep(currentStep - 1);
  };

  const handleComplete = async () => {
    if (!inspectionId) return;
    setCompleting(true);
    await supabase.from("inspections").update({ statut: "complete" }).eq("id", inspectionId);
    setCompleting(false);
    onComplete();
  };

  const goToRecap = () => {
    setViewMode("recap");
  };

  const goBackToCapture = (stepIndex?: number) => {
    if (stepIndex !== undefined) setCurrentStep(stepIndex);
    setViewMode("capture");
  };

  const hasCurrentPhoto = !!photos[currentVue.id];

  // Transition classes
  const slideClass = isTransitioning
    ? slideDirection === "right"
      ? "opacity-0 translate-x-8"
      : "opacity-0 -translate-x-8"
    : "opacity-100 translate-x-0";

  // ─── RECAP VIEW ───
  if (viewMode === "recap") {
    return (
      <div className="fixed inset-0 z-50 bg-navy flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-navy-light border-b border-primary/20">
          <button onClick={() => goBackToCapture()} className="text-cream/50 hover:text-cream flex items-center gap-1 text-xs">
            <ArrowLeft size={16} /> Retour
          </button>
          <h2 className="font-heading text-sm text-primary uppercase tracking-wider">
            Récapitulatif
          </h2>
          <span className="text-cream/50 text-xs">{Object.keys(photos).length}/{VUE_TYPES.length}</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="text-center mb-4">
            <p className="font-heading text-primary text-lg uppercase tracking-wider">
              État des lieux {type === "depart" ? "départ" : "arrivée"}
            </p>
            <p className="text-cream/40 text-xs mt-1">
              {allPhotosComplete
                ? "Toutes les photos sont prises. Vérifiez avant de valider."
                : `${missingPhotos.length} photo(s) manquante(s)`}
            </p>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-3 gap-2">
            {VUE_TYPES.map((v, i) => {
              const hasPhoto = !!photos[v.id];
              return (
                <button
                  key={v.id}
                  onClick={() => goBackToCapture(i)}
                  className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    hasPhoto
                      ? "border-green-500/40 hover:border-green-500/70"
                      : "border-destructive/40 hover:border-destructive/70 bg-navy-light"
                  }`}
                >
                  {hasPhoto ? (
                    <>
                      <img src={photos[v.id]} alt={v.label} className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-1">
                      <Camera size={16} className="text-destructive/50 mb-1" />
                      <span className="text-destructive/60 text-[9px] text-center leading-tight">Manquante</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-navy/80 px-1 py-0.5">
                    <p className="text-cream/80 text-[9px] text-center truncate">{v.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Validate button */}
        <div className="px-4 py-4 bg-navy-light border-t border-primary/20 space-y-2">
          {!allPhotosComplete && (
            <button
              onClick={() => {
                const nextMissing = VUE_TYPES.findIndex((v) => !photos[v.id]);
                if (nextMissing >= 0) goBackToCapture(nextMissing);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 border border-primary/30 text-primary font-heading text-sm tracking-wider uppercase"
            >
              <Camera size={16} /> Compléter les photos manquantes
            </button>
          )}
          <button
            onClick={handleComplete}
            disabled={!allPhotosComplete || completing}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-heading text-sm tracking-wider uppercase disabled:opacity-40 transition-opacity"
          >
            {completing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
            {completing ? "Validation..." : "Valider l'état des lieux"}
          </button>
        </div>
      </div>
    );
  }

  // ─── CAPTURE VIEW ───
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
      <div className="h-1.5 bg-navy-light relative overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-0 h-full bg-primary/30 transition-all duration-300"
          style={{ width: `${((currentStep + 1) / VUE_TYPES.length) * 100}%` }}
        />
      </div>

      {/* Main content with slide animation */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-auto">
        <div className={`w-full max-w-sm transition-all duration-200 ease-out ${slideClass}`}>
          {/* Photo area */}
          <div className="w-full aspect-[3/4] relative rounded-lg overflow-hidden border-2 border-primary/30 bg-navy-light mb-4">
            {hasCurrentPhoto ? (
              <img src={photos[currentVue.id]} alt={currentVue.label} className="w-full h-full object-cover animate-scale-in" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-28 h-28 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center mb-3">
                  <Camera size={28} className="text-primary/40" />
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
          <p className="font-heading text-primary text-base mb-0.5 text-center">{currentVue.label}</p>
          <p className="text-cream/40 text-xs mb-4 text-center">{currentVue.description}</p>
        </div>

        {/* Step dots */}
        <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
          {VUE_TYPES.map((v, i) => (
            <button
              key={v.id}
              onClick={() => animateStep(i)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i === currentStep ? "bg-primary scale-125 shadow-[0_0_8px_rgba(212,175,55,0.4)]" :
                photos[v.id] ? "bg-green-500" : "bg-cream/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 bg-navy-light border-t border-primary/20 space-y-2">
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
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-wider uppercase disabled:opacity-50 transition-opacity"
          >
            <Camera size={18} /> Prendre la photo
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleRetake}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-primary/30 text-primary text-sm rounded transition-colors hover:bg-primary/5"
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
            ) : (
              <button
                onClick={goToRecap}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-heading text-sm tracking-wider uppercase"
              >
                <Eye size={16} /> Vérifier
              </button>
            )}
          </div>
        )}

        {/* Navigation row */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center gap-1 text-xs text-cream/40 hover:text-cream disabled:opacity-20 transition-colors"
          >
            <ArrowLeft size={14} /> Précédent
          </button>

          {Object.keys(photos).length > 0 && (
            <button
              onClick={goToRecap}
              className="flex items-center gap-1 text-xs text-primary hover:text-gold-light transition-colors"
            >
              <Eye size={14} /> Récapitulatif ({Object.keys(photos).length}/{VUE_TYPES.length})
            </button>
          )}

          {!hasCurrentPhoto && currentStep < VUE_TYPES.length - 1 && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1 text-xs text-cream/40 hover:text-cream transition-colors"
            >
              Passer <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
