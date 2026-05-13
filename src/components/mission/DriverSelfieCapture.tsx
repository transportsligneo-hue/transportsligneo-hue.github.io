/**
 * DriverSelfieCapture — Étape 0 : selfie identité du convoyeur.
 *
 * Flow:
 *   1. Ouvrir caméra (capture="user") via clic direct utilisateur
 *   2. Preview immédiate du selfie capturé
 *   3. Footer sticky : Reprendre / Valider et continuer
 *   4. Validation = upload + insert + close (auto-advance côté parent)
 */
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Check, X, AlertCircle, MapPin, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";

interface Props {
  attributionId: string;
  userId: string;
  onCaptured: () => Promise<void> | void;
  onClose: () => void;
}

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

export function DriverSelfieCapture({ attributionId, userId, onCaptured, onClose }: Props) {
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle"|"uploading"|"success"|"error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{lat:number;lng:number}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);
  const canValidate = !!capturedFile && status !== "uploading" && status !== "success";

  useEffect(() => {
    return () => {
      if (preview) {
        try { URL.revokeObjectURL(preview); } catch { /* ignore */ }
      }
    };
  }, [preview]);

  const openCamera = () => fileRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    if (preview) { try { URL.revokeObjectURL(preview); } catch { /* ignore */ } }
    setCapturedFile(raw);
    setPreview(URL.createObjectURL(raw));
    setStatus("idle");
    setError(null);
    // Géoloc en arrière-plan, non bloquante
    getPosition().then(p => { if (p) setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); });
    if (fileRef.current) fileRef.current.value = "";
  };

  const retake = () => {
    if (preview) { try { URL.revokeObjectURL(preview); } catch { /* ignore */ } }
    setCapturedFile(null);
    setPreview(null);
    setStatus("idle");
    setError(null);
    closingRef.current = false;
    setTimeout(openCamera, 50);
  };

  const finalizeStep = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    void Promise.resolve(onCaptured())
      .then(() => onClose())
      .catch((err) => {
        closingRef.current = false;
        const msg = err instanceof Error ? err.message : "Réessayez dans quelques secondes.";
        setStatus("error");
        setError(msg);
        toast.error("Mission non synchronisée", { description: msg });
      });
  };

  const validate = async () => {
    if (!capturedFile) return;
    setStatus("uploading");
    setError(null);
    try {
      const pos = await getPosition();
      if (pos) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });

      let file: File;
      try { file = await compressImage(capturedFile); } catch { file = capturedFile; }

      const isJpeg = file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg");
      const ext = isJpeg ? "jpg" : (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
      const contentType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
      const path = `${userId}/${attributionId}/selfie_${Date.now()}.${ext}`;

      const upload = async () => supabase.storage
        .from("mission-selfies")
        .upload(path, file, { upsert: true, contentType });
      let { error: upErr } = await upload();
      if (upErr) {
        await new Promise(r => setTimeout(r, 800));
        ({ error: upErr } = await upload());
      }
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("mission_selfies" as never).insert({
        attribution_id: attributionId,
        convoyeur_user_id: userId,
        storage_path: path,
        latitude: pos?.coords.latitude ?? null,
        longitude: pos?.coords.longitude ?? null,
        accuracy: pos?.coords.accuracy ?? null,
      } as never);
      if (dbErr) throw dbErr;

      setStatus("success");
      toast.success("Selfie validé", { description: "Passage automatique à l'étape suivante." });
      setTimeout(finalizeStep, 180);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec";
      setStatus("error");
      setError(msg);
      closingRef.current = false;
      toast.error("Échec selfie", { description: msg });
    }
  };

  return (
    <div className="driver-selfie-shell fixed inset-0 z-[80] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden overscroll-none">
      <div className="driver-selfie-header flex items-center justify-between px-4 py-3 text-white shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Fermer"><X size={20}/></button>
        <div className="text-center">
          <p className="driver-eyebrow opacity-80">Étape 1 — Identité</p>
          <p className="text-sm font-semibold">Selfie convoyeur</p>
        </div>
        <div className="w-9"/>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-3 pb-4">
        <div className="driver-selfie-stage relative flex h-full w-full max-w-md items-center justify-center overflow-hidden rounded-[24px] px-4 py-5">
        {preview ? (
          <img src={preview} alt="Selfie" className="max-h-full w-full rounded-[20px] object-contain"/>
        ) : (
          <div className="text-center text-white/70 max-w-sm">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--driver-border-strong)] bg-white/6 shadow-[0_0_36px_-12px_rgba(59,130,246,0.55)]">
              <Camera size={40} className="text-[var(--driver-accent-2)]"/>
            </div>
            <p className="text-base font-semibold text-white mb-2">Prenez un selfie</p>
            <p className="text-sm opacity-80">Photo d'identité horodatée et géolocalisée. Visage net, bien éclairé.</p>
          </div>
        )}

        {status === "uploading" && (
          <div className="driver-selfie-status absolute top-4 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white">
            <Loader2 className="animate-spin" size={14}/> Envoi…
          </div>
        )}
        {status === "success" && (
          <div className="absolute top-4 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
            <Check size={14}/> Selfie validé
          </div>
        )}
        {status === "error" && (
          <div className="absolute top-4 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 truncate">
            <AlertCircle size={14}/> {error}
          </div>
        )}
        {coords && preview && (
          <div className="driver-selfie-status absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] text-white/80">
            <MapPin size={11}/> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        )}
        </div>
      </div>

      {/* Sticky footer toujours visible */}
      <div className="driver-selfie-footer sticky bottom-0 shrink-0 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handleFile} className="hidden"/>
        {!preview ? (
          <button
            onClick={openCamera}
            className="driver-cta flex w-full items-center justify-center gap-2 py-4 text-base font-bold"
          >
            <Camera size={20}/> Ouvrir l'appareil photo
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <button
              onClick={retake}
              disabled={status === "uploading" || status === "success"}
              className="driver-secondary-cta flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[11px]"
            >
              <RotateCcw size={16}/>
              <span className="leading-tight">Reprendre selfie</span>
            </button>
            <button
              onClick={validate}
              disabled={!canValidate}
              className="driver-cta flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[11px]"
            >
              {status === "uploading" ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>}
              <span className="leading-tight">{status === "success" ? "Validation en cours" : "Valider et continuer"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
