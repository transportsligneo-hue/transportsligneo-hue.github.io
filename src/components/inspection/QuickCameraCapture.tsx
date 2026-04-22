/**
 * QuickCameraCapture — bouton de prise de photo terrain ultra rapide.
 *
 * Robustesse :
 *  - upload non bloquant (l'app reste utilisable pendant l'upload)
 *  - retry automatique 2x sur échec réseau
 *  - feedback visuel : preview locale immédiate, statut envoi, succès, erreur
 *  - toasts d'erreur clairs
 *  - aucun crash si l'upload échoue (try/catch + fallback)
 *  - le tap sur l'arrière-plan NE FERME PAS la modale (bug critique précédent)
 */
import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Check, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
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

type Status = "idle" | "uploading" | "success" | "error";

async function uploadWithRetry(path: string, file: File, attempts = 3): Promise<void> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const { error } = await supabase.storage
        .from("inspection-photos")
        .upload(path, file, { upsert: true, contentType: "image/jpeg" });
      if (!error) return;
      lastErr = error;
      console.warn(`[upload] tentative ${i + 1} échec:`, error.message);
    } catch (e) {
      lastErr = e;
      console.warn(`[upload] tentative ${i + 1} exception:`, e);
    }
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  throw lastErr ?? new Error("Upload échoué");
}

export function QuickCameraCapture({
  inspectionId, userId, zoneId, zoneLabel, existingUrl, onCaptured, onClose,
}: Props) {
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);
  const [status, setStatus] = useState<Status>("idle");
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;

    // Aperçu local IMMÉDIAT — n'attend pas l'upload
    const localUrl = URL.createObjectURL(raw);
    setPreview(localUrl);
    setStatus("uploading");
    setErrorMsg(null);

    try {
      console.log("[QuickCamera] compression…", { size: raw.size });
      const file = await compressImage(raw);
      console.log("[QuickCamera] compressé:", { from: raw.size, to: file.size });

      const path = `${userId}/${inspectionId}/zone_${zoneId}_${Date.now()}.jpg`;

      console.log("[QuickCamera] upload storage:", path);
      await uploadWithRetry(path, file);

      console.log("[QuickCamera] insert DB row…");
      const { error: dbErr } = await supabase.from("inspection_photos").upsert(
        {
          inspection_id: inspectionId,
          vue_type: `zone_${zoneId}`,
          url_photo: path,
          zone_id: zoneId,
          file_size_bytes: file.size,
        },
        { onConflict: "inspection_id,vue_type" }
      );
      if (dbErr) throw dbErr;

      setSavedPath(path);
      setStatus("success");
      toast.success("Photo envoyée");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec d'envoi";
      console.error("[QuickCamera] upload error:", err);
      setStatus("error");
      setErrorMsg(msg);
      toast.error("Échec d'envoi de la photo", { description: msg });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const validate = () => {
    if (savedPath) onCaptured(savedPath);
    onClose();
  };

  // FIX BUG : on n'attache plus onClick={onClose} sur le wrapper plein écran.
  // L'ancienne version fermait la modale au moindre tap → bug terrain critique.
  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Fermer">
          <X size={20} />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider opacity-60">Photo zone</p>
          <p className="text-sm font-semibold">{zoneLabel}</p>
        </div>
        <div className="w-9" />
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {preview ? (
          <img
            src={preview}
            alt={zoneLabel}
            className="max-w-full max-h-full rounded-lg object-contain"
          />
        ) : (
          <div className="text-center text-white/60">
            <Camera size={64} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucune photo prise pour cette zone</p>
            <p className="text-xs mt-1">Tapez le bouton ci-dessous pour commencer</p>
          </div>
        )}

        {/* Statut visuel non bloquant */}
        {status === "uploading" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-black/80 text-white rounded-full text-xs">
            <Loader2 className="animate-spin" size={14} /> Envoi en cours…
          </div>
        )}
        {status === "success" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-full text-xs">
            <Check size={14} /> Photo envoyée
          </div>
        )}
        {status === "error" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-full text-xs max-w-[90%]">
            <AlertCircle size={14} /> {errorMsg ?? "Échec"}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-4 bg-black/80 space-y-2 safe-bottom">
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
            disabled={status === "uploading"}
            className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-50"
          >
            <Camera size={20} /> Ouvrir l'appareil photo
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={open}
              disabled={status === "uploading"}
              className="flex items-center justify-center gap-1.5 py-3 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 disabled:opacity-50"
            >
              <RotateCcw size={16} /> {status === "error" ? "Réessayer" : "Reprendre"}
            </button>
            <button
              onClick={validate}
              disabled={status === "uploading" || status === "error"}
              className="flex items-center justify-center gap-1.5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check size={16} /> Valider
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
