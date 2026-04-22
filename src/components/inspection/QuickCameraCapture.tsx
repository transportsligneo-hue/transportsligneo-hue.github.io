/**
 * QuickCameraCapture — bouton de prise de photo terrain ultra rapide.
 *
 * - Ouvre directement l'appareil photo arrière du téléphone (capture="environment")
 * - Compresse l'image avant upload (compressImage existant)
 * - Affiche aperçu immédiat + actions reprendre/valider
 * - Compatible existant : utilise le bucket inspection-photos déjà configuré
 *   et écrit dans inspection_photos avec un vue_type personnalisé (zone_xxx)
 */
import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";

interface Props {
  inspectionId: string;
  userId: string;
  zoneId: string;
  zoneLabel: string;
  existingUrl?: string;
  onCaptured: (storagePath: string) => void;
  onClose: () => void;
}

export function QuickCameraCapture({
  inspectionId, userId, zoneId, zoneLabel, existingUrl, onCaptured, onClose,
}: Props) {
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setUploading(true);
    try {
      const file = await compressImage(raw);
      const path = `${userId}/${inspectionId}/zone_${zoneId}_${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from("inspection-photos")
        .upload(path, file, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;

      await supabase.from("inspection_photos").upsert({
        inspection_id: inspectionId,
        vue_type: `zone_${zoneId}`,
        url_photo: path,
      }, { onConflict: "inspection_id,vue_type" });

      setPreview(URL.createObjectURL(file));
      setSavedPath(path);
    } catch (err) {
      console.error("Upload error:", err);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const validate = () => {
    if (savedPath) onCaptured(savedPath);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
          <X size={20} />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider opacity-60">Photo zone</p>
          <p className="text-sm font-semibold">{zoneLabel}</p>
        </div>
        <div className="w-9" />
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        {preview ? (
          <img src={preview} alt={zoneLabel} className="max-w-full max-h-full rounded-lg object-contain" />
        ) : (
          <div className="text-center text-white/60">
            <Camera size={64} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucune photo prise pour cette zone</p>
            <p className="text-xs mt-1">Tapez le bouton ci-dessous pour commencer</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <Loader2 className="animate-spin text-white" size={40} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-4 bg-black/80 space-y-2 safe-bottom" onClick={e => e.stopPropagation()}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />

        {!preview ? (
          <button
            onClick={open}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-50"
          >
            <Camera size={20} /> Ouvrir l'appareil photo
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={open}
              disabled={uploading}
              className="flex items-center justify-center gap-1.5 py-3 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20"
            >
              <RotateCcw size={16} /> Reprendre
            </button>
            <button
              onClick={validate}
              disabled={uploading}
              className="flex items-center justify-center gap-1.5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700"
            >
              <Check size={16} /> Valider
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
