import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, RotateCcw, ArrowRight, Check, Loader2, X, ArrowLeft, Eye, CloudOff, CloudUpload, AlertCircle, Sparkles } from "lucide-react";
import { CarSilhouetteOverlay } from "./inspection/CarSilhouetteOverlay";
import { compressImage } from "@/lib/image-compression";
import { enqueueUpload, subscribeQueue, pendingKeysForInspection, kickQueue } from "@/lib/edl-offline-queue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useServerFn } from "@tanstack/react-start";
import { useAiCapability } from "@/lib/ai/context";
import { photoQualityCheck } from "@/lib/ai/photo-quality.functions";
import { analyzePhotoDamage } from "@/lib/ai/analyze-photo.functions";
import { PhotoQualityToast } from "./ai/PhotoQualityToast";
import { AiAssistantPanel, type AiSuggestion } from "./ai/AiAssistantPanel";
import type { PhotoQuality } from "@/lib/ai/types";

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
  const [pendingUploads, setPendingUploads] = useState<Record<string, boolean>>({});
  const [syncState, setSyncState] = useState<Record<string, "pending" | "sent" | "failed">>({});
  const [captureIds, setCaptureIds] = useState<Record<string, string>>({});
  const [completing, setCompleting] = useState(false);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("capture");
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const online = useOnlineStatus();
  // ─── Assistant IA (non-bloquant, cadres l'utilisateur mais ne bloque jamais)
  const qualityEnabled = useAiCapability("photo_assistant");
  const suggestEnabled = useAiCapability("smart_suggestions");
  const runQuality = useServerFn(photoQualityCheck);
  const runDamage = useServerFn(analyzePhotoDamage);
  const [qualities, setQualities] = useState<Record<string, PhotoQuality>>({});
  const [dismissedQuality, setDismissedQuality] = useState<Record<string, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

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

  // Crée l'inspection en amont pour que le 1er upload n'attende pas l'INSERT
  useEffect(() => {
    void ensureInspection().catch(() => { /* réessai au 1er upload */ });
  }, [ensureInspection]);

  // Libère les blob URLs à la fermeture
  useEffect(() => {
    return () => {
      Object.values(photos).forEach((url) => {
        if (url?.startsWith("blob:")) {
          try { URL.revokeObjectURL(url); } catch { /* noop */ }
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Écoute la file de synchro pour mettre à jour le statut par vignette.
  useEffect(() => {
    const unsub = subscribeQueue((key, state) => {
      const [insId, vueType] = key.split(":");
      if (!inspectionId || insId !== inspectionId) return;
      setSyncState((prev) => ({ ...prev, [vueType]: state }));
      if (state === "sent") {
        setPendingUploads((prev) => {
          const { [vueType]: _, ...rest } = prev;
          return rest;
        });
      }
    });
    return () => { unsub(); };
  }, [inspectionId]);

  // Au montage, si des uploads sont encore en file pour cette inspection,
  // marque leur statut "pending" et relance la file.
  useEffect(() => {
    if (!inspectionId) return;
    void pendingKeysForInspection(inspectionId).then((keys) => {
      if (keys.length === 0) return;
      setSyncState((prev) => {
        const next = { ...prev };
        keys.forEach((k) => { next[k.split(":")[1]] = "pending"; });
        return next;
      });
      kickQueue();
    });
  }, [inspectionId]);



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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !currentVue) return;
    const vueId = currentVue.id;
    const captureId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Reset input immediately so user can re-pick same file later
    if (fileInputRef.current) fileInputRef.current.value = "";

    // 1) Local preview instant · révoque l'ancien blob pour éviter les fuites mémoire
    const previewUrl = URL.createObjectURL(rawFile);
    setPhotos((prev) => {
      const old = prev[vueId];
      if (old && old.startsWith("blob:")) {
        try { URL.revokeObjectURL(old); } catch { /* noop */ }
      }
      return { ...prev, [vueId]: previewUrl };
    });
    setCaptureIds((prev) => ({ ...prev, [vueId]: captureId }));
    setPendingUploads((prev) => ({ ...prev, [vueId]: true }));
    setSyncState((prev) => ({ ...prev, [vueId]: "pending" }));

    // 2) Compression + mise en file offline en arrière-plan.
    //    L'utilisateur peut immédiatement passer à la vue suivante.
    void (async () => {
      try {
        const file = await compressImage(rawFile, { maxDimension: 1280, quality: 0.72 });
        const insId = await ensureInspection();
        // Race guard : la photo a-t-elle été reprise entre temps ?
        let stillCurrent = false;
        setCaptureIds((prev) => {
          stillCurrent = prev[vueId] === captureId;
          return prev;
        });
        if (!stillCurrent) return;

        const path = `${userId}/${insId}/${vueId}.jpg`;
        await enqueueUpload({
          key: `${insId}:${vueId}`,
          inspectionId: insId,
          vueType: vueId,
          path,
          blob: file,
          contentType: "image/jpeg",
          captureId,
        });

        // 3) Assistant IA en tâche de fond · jamais bloquant.
        //    Nécessite d'être en ligne + capacités activées.
        if (online && (qualityEnabled || suggestEnabled)) {
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(String(r.result));
              r.onerror = () => reject(new Error("read-failed"));
              r.readAsDataURL(file);
            });
            setAiRunning(true);
            const previewForVue = previewUrl;
            const tasks: Promise<unknown>[] = [];
            if (qualityEnabled) {
              tasks.push(
                runQuality({ data: { image_data_url: dataUrl, expected_subject: currentVue?.label ?? vueId } })
                  .then((res) => {
                    if (res.ok) {
                      setQualities((prev) => ({ ...prev, [vueId]: res.quality }));
                      setDismissedQuality((prev) => ({ ...prev, [vueId]: false }));
                    }
                  })
                  .catch(() => { /* silencieux */ }),
              );
            }
            if (suggestEnabled) {
              tasks.push(
                runDamage({ data: { image_data_url: dataUrl, zone_hint: currentVue?.label } })
                  .then((res) => {
                    if (res.ok && res.analysis.detections.length > 0) {
                      const additions: AiSuggestion[] = res.analysis.detections.map((d, i) => ({
                        id: `${vueId}:${captureId}:${i}`,
                        imageUrl: previewForVue,
                        detection: d,
                      }));
                      setAiSuggestions((prev) => [
                        ...prev.filter((s) => !s.id.startsWith(`${vueId}:`)),
                        ...additions,
                      ]);
                    }
                  })
                  .catch(() => { /* silencieux */ }),
              );
            }
            await Promise.allSettled(tasks);
          } catch { /* silencieux */ }
          finally { setAiRunning(false); }
        }
      } catch (err) {
        console.error("Enqueue error:", err);
        setSyncState((prev) => ({ ...prev, [vueId]: "failed" }));
        setPendingUploads((prev) => {
          const { [vueId]: _, ...rest } = prev;
          return rest;
        });
      }
    })();
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
  const pendingSyncCount = Object.values(syncState).filter((s) => s === "pending").length;
  const failedSyncCount = Object.values(syncState).filter((s) => s === "failed").length;

  // Transition classes
  const slideClass = isTransitioning
    ? slideDirection === "right"
      ? "opacity-0 translate-x-8"
      : "opacity-0 -translate-x-8"
    : "opacity-100 translate-x-0";

  const syncBadge = (!online || pendingSyncCount > 0 || failedSyncCount > 0) ? (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${
      !online ? "border-amber-400/40 text-amber-300 bg-amber-500/10"
      : failedSyncCount > 0 ? "border-destructive/40 text-destructive bg-destructive/10"
      : "border-primary/30 text-primary bg-primary/10"
    }`}>
      {!online ? <><CloudOff size={10} /> Hors ligne</>
        : failedSyncCount > 0 ? <><AlertCircle size={10} /> {failedSyncCount} en attente</>
        : <><CloudUpload size={10} /> Envoi {pendingSyncCount}</>}
    </div>
  ) : null;

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
          <div className="flex items-center gap-2">
            {syncBadge}
            <span className="text-cream/50 text-xs">{Object.keys(photos).length}/{VUE_TYPES.length}</span>
          </div>
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
                      <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                        syncState[v.id] === "failed" ? "bg-destructive"
                        : syncState[v.id] === "pending" ? "bg-amber-500"
                        : "bg-green-500"
                      }`}>
                        {syncState[v.id] === "pending"
                          ? <Loader2 size={11} className="text-white animate-spin" />
                          : syncState[v.id] === "failed"
                          ? <AlertCircle size={11} className="text-white" />
                          : <Check size={12} className="text-white" />}
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

          {/* Assistant IA · suggestions de défauts détectés */}
          {suggestEnabled && (aiRunning || aiSuggestions.length > 0) && (
            <div className="mt-4">
              <AiAssistantPanel
                suggestions={aiSuggestions}
                loading={aiRunning}
                title="Défauts détectés par l'IA"
                onConfirm={(s) => setAiSuggestions((prev) => prev.filter((x) => x.id !== s.id))}
                onIgnore={(s) => setAiSuggestions((prev) => prev.filter((x) => x.id !== s.id))}
              />
            </div>
          )}
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
        <div className="flex items-center gap-2">
          {syncBadge}
          <span className="text-cream/50 text-xs">{currentStep + 1}/{VUE_TYPES.length}</span>
        </div>
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
              <>
                {/* Silhouette guide overlay */}
                <CarSilhouetteOverlay variant={currentVue.id as Parameters<typeof CarSilhouetteOverlay>[0]["variant"]} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 to-transparent px-4 py-3 text-center">
                  <p className="font-heading text-primary text-base">{currentVue.label}</p>
                  <p className="text-cream/50 text-xs mt-0.5">{currentVue.description}</p>
                </div>
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-navy/70 border border-primary/30">
                  <p className="text-primary text-[10px] uppercase tracking-wider">Cadrer selon la silhouette</p>
                </div>
              </>
            )}
            {pendingUploads[currentVue.id] && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-navy/80 border border-primary/30 flex items-center gap-1.5">
                <Loader2 className="animate-spin text-primary" size={12} />
                <span className="text-primary text-[10px] uppercase tracking-wider">Envoi…</span>
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
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-wider uppercase transition-opacity"
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

      {/* Assistant IA · toast qualité photo (non-bloquant) */}
      {qualityEnabled && qualities[currentVue.id] && !dismissedQuality[currentVue.id] && (
        <PhotoQualityToast
          quality={qualities[currentVue.id]}
          onDismiss={() => setDismissedQuality((prev) => ({ ...prev, [currentVue.id]: true }))}
          onRetake={() => {
            setDismissedQuality((prev) => ({ ...prev, [currentVue.id]: true }));
            handleRetake();
          }}
        />
      )}

      {/* Bouton d'accès aux suggestions IA (défauts détectés) */}
      {suggestEnabled && aiSuggestions.length > 0 && (
        <button
          type="button"
          onClick={() => setAiPanelOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex items-center gap-1.5 rounded-full border border-primary/40 bg-navy/90 px-3 py-1.5 text-xs text-primary shadow-lg backdrop-blur hover:bg-navy"
        >
          <Sparkles size={14} /> {aiSuggestions.length} suggestion{aiSuggestions.length > 1 ? "s" : ""} IA
        </button>
      )}

      {aiPanelOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3" onClick={() => setAiPanelOpen(false)}>
          <div className="w-full max-w-md max-h-[80vh] overflow-auto rounded-t-2xl border border-primary/30 bg-navy p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-primary text-sm uppercase tracking-wider">Suggestions IA</h3>
              <button onClick={() => setAiPanelOpen(false)} className="text-cream/60 hover:text-cream"><X size={18} /></button>
            </div>
            <AiAssistantPanel
              suggestions={aiSuggestions}
              loading={aiRunning}
              onConfirm={(s) => setAiSuggestions((prev) => prev.filter((x) => x.id !== s.id))}
              onIgnore={(s) => setAiSuggestions((prev) => prev.filter((x) => x.id !== s.id))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
