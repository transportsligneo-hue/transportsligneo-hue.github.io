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
import { Camera, Loader2, Check, X, AlertCircle, MapPin, RotateCcw, ChevronRight } from "lucide-react";
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
  const canValidate = !!capturedFile && status !== "uploading" && status !== "success";
  const canGoNext = status === "success";

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
    setTimeout(openCamera, 50);
  };

  const goNext = () => {
    if (!canGoNext) return;
    void Promise.resolve(onCaptured()).finally(onClose);
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
      toast.success("Selfie validé", { description: "Appuyez sur Page suivante pour continuer la mission." });
      setTimeout(() => {
        void Promise.resolve(onCaptured()).finally(onClose);
      }, 350);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec";
      setStatus("error");
      setError(msg);
      toast.error("Échec selfie", { description: msg });
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#0b1026] overscroll-none">
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 text-white shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Fermer"><X size={20}/></button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider opacity-60">Étape 1 — Identité</p>
          <p className="text-sm font-semibold">Selfie convoyeur</p>
        </div>
        <div className="w-9"/>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-3 pb-4">
        {preview ? (
          <img src={preview} alt="Selfie" className="max-w-full max-h-full rounded-2xl object-contain border-2 border-[#d4af37]"/>
        ) : (
          <div className="text-center text-white/70 max-w-sm">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-[#d4af37]/10 border-2 border-[#d4af37]/40 flex items-center justify-center">
              <Camera size={40} className="text-[#d4af37]"/>
            </div>
            <p className="text-base font-semibold text-white mb-2">Prenez un selfie</p>
            <p className="text-sm opacity-80">Photo d'identité horodatée et géolocalisée. Visage net, bien éclairé.</p>
          </div>
        )}

        {status === "uploading" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-black/80 text-white rounded-full text-xs">
            <Loader2 className="animate-spin" size={14}/> Envoi…
          </div>
        )}
        {status === "success" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-full text-xs">
            <Check size={14}/> Validé
          </div>
        )}
        {status === "error" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-full text-xs max-w-[90%] truncate">
            <AlertCircle size={14}/> {error}
          </div>
        )}
        {coords && preview && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-black/70 text-white/80 rounded-full text-[10px]">
            <MapPin size={11}/> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        )}
      </div>

      {/* Sticky footer toujours visible */}
      <div className="sticky bottom-0 shrink-0 border-t border-white/10 bg-black/70 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
        <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handleFile} className="hidden"/>
        {!preview ? (
          <button
            onClick={openCamera}
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#d4af37] text-[#0b1026] rounded-xl text-base font-bold hover:bg-[#e7c76a] active:scale-[0.98] transition"
          >
            <Camera size={20}/> Ouvrir l'appareil photo
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={retake}
              disabled={status === "uploading" || status === "success"}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-white/10 px-2 py-2 text-center text-[11px] font-semibold text-white transition hover:bg-white/20 active:scale-[0.98] disabled:opacity-40"
            >
              <RotateCcw size={16}/>
              <span className="leading-tight">Reprendre selfie</span>
            </button>
            <button
              onClick={validate}
              disabled={!canValidate}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-emerald-500 px-2 py-2 text-center text-[11px] font-bold text-[#0b1026] transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
            >
              {status === "uploading" ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>}
              <span className="leading-tight">{status === "success" ? "Selfie validé" : "Valider et continuer"}</span>
            </button>
            <button
              onClick={goNext}
              disabled={!canGoNext}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-[#d4af37] px-2 py-2 text-center text-[11px] font-bold text-[#0b1026] transition hover:bg-[#e7c76a] active:scale-[0.98] disabled:opacity-40"
            >
              <ChevronRight size={18}/>
              <span className="leading-tight">Page suivante</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
