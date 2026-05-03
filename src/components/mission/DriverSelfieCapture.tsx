/**
 * DriverSelfieCapture — Étape 0 : selfie identité du convoyeur.
 *
 * - Caméra avant (capture="user")
 * - Géolocalisation horodatée
 * - Upload vers bucket mission-selfies
 * - Insert dans mission_selfies
 *
 * Bypass possible via mission_step_overrides (step_key='selfie', mode='disable'/'skip').
 */
import { useRef, useState } from "react";
import { Camera, Loader2, Check, X, AlertCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";

interface Props {
  attributionId: string;
  userId: string;
  onCaptured: () => void;
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
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle"|"uploading"|"success"|"error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{lat:number;lng:number;acc:number|null}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    const local = URL.createObjectURL(raw);
    setPreview(local);
    setStatus("uploading");
    setError(null);

    try {
      const pos = await getPosition();
      if (pos) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });

      const file = await compressImage(raw);
      const path = `${userId}/${attributionId}/selfie_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("mission-selfies")
        .upload(path, file, { upsert: true, contentType: "image/jpeg" });
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
      toast.success("Selfie identité enregistré");
      setTimeout(() => { onCaptured(); onClose(); }, 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec";
      setStatus("error");
      setError(msg);
      toast.error("Échec selfie", { description: msg });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-[#0b1026] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 text-white">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X size={20}/></button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider opacity-60">Étape 0 — Identité</p>
          <p className="text-sm font-semibold">Selfie convoyeur obligatoire</p>
        </div>
        <div className="w-9"/>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative">
        {preview ? (
          <img src={preview} alt="Selfie" className="max-w-full max-h-full rounded-2xl object-contain border-2 border-[#d4af37]"/>
        ) : (
          <div className="text-center text-white/70 max-w-sm">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-[#d4af37]/10 border-2 border-[#d4af37]/40 flex items-center justify-center">
              <Camera size={40} className="text-[#d4af37]"/>
            </div>
            <p className="text-base font-semibold text-white mb-2">Prenez un selfie</p>
            <p className="text-sm opacity-80">Photo d'identité horodatée et géolocalisée pour valider votre prise de mission. Visage net, bien éclairé.</p>
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
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-full text-xs">
            <AlertCircle size={14}/> {error}
          </div>
        )}
        {coords && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-black/70 text-white/80 rounded-full text-[10px]">
            <MapPin size={11}/> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        )}
      </div>

      <div className="px-4 py-4 bg-black/40 safe-bottom">
        <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handleFile} className="hidden"/>
        <button
          onClick={open}
          disabled={status === "uploading"}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#d4af37] text-[#0b1026] rounded-xl text-base font-bold hover:bg-[#e7c76a] active:scale-[0.98] transition disabled:opacity-50"
        >
          <Camera size={20}/> {preview ? "Reprendre" : "Ouvrir l'appareil photo"}
        </button>
      </div>
    </div>
  );
}
