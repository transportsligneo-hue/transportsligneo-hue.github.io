import { useRef, useState } from "react";
import { Camera, Crop, Loader2, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmToast } from "@/lib/confirm-toast";
import { AvatarCropDialog } from "@/components/admin/AvatarCropDialog";

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"];
const MAX_BYTES = 8 * 1024 * 1024;

interface Props {
  /** Utilisateur (auth) propriétaire de la photo — optionnel. */
  ownerUserId?: string | null;
  /** Convoyeur concerné : permet d'importer une photo même sans compte lié. */
  convoyeurId?: string | null;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}

/**
 * Permet à un admin d'importer / recadrer / remplacer la photo de profil
 * d'un convoyeur ou d'un client qui n'y arrive pas lui-même.
 */
export function AdminAvatarUploader({ ownerUserId, convoyeurId, value, onChange, label = "Photo de profil" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const target = ownerUserId ?? convoyeurId ?? null;
  const disabled = !target || busy;

  const pickFile = (file: File) => {
    if (file.type && !ACCEPTED.includes(file.type)) {
      toast.error("Format non supporté (PNG, JPG, WEBP)");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Fichier trop volumineux (8 Mo max)");
      return;
    }
    setPendingFile(file);
  };

  const persistUrl = async (url: string | null) => {
    let saved = false;
    if (ownerUserId) {
      const { error, data } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("user_id", ownerUserId)
        .select("user_id");
      if (error) throw error;
      saved = (data?.length ?? 0) > 0;
    }
    if (convoyeurId) {
      const { error, data } = await supabase
        .from("convoyeurs")
        .update({ avatar_url: url } as never)
        .eq("id", convoyeurId)
        .select("id");
      if (error) throw error;
      saved = saved || (data?.length ?? 0) > 0;
    }
    if (!saved) throw new Error("Aucune fiche mise à jour (droits insuffisants ?)");
  };

  const handleCropped = async (blob: Blob) => {
    if (!target) return;
    setBusy(true);
    try {
      const path = `${target}/avatar-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await persistUrl(data.publicUrl);
      onChange(data.publicUrl);
      toast.success("Photo de profil mise à jour");
      setPendingFile(null);
    } catch (e) {
      console.error("[AdminAvatarUploader] upload failed", e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi de la photo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!target || !value) return;
    if (!(await confirmToast("Supprimer la photo de profil ?"))) return;
    setBusy(true);
    try {
      const marker = "/avatars/";
      const idx = value.indexOf(marker);
      if (idx >= 0) await supabase.storage.from("avatars").remove([value.substring(idx + marker.length)]);
      await persistUrl(null);
      onChange(null);
      toast.success("Photo supprimée");
    } catch (e) {
      console.error("[AdminAvatarUploader] remove failed", e);
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
        {value ? (
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <UserRound size={28} className="text-slate-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {target ? "PNG, JPG, WEBP · 8 Mo max · recadrage circulaire" : "Fiche non identifiée"}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md bg-[#2F5FFF] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2450e0] disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {value ? "Changer" : "Importer"}
          </button>
          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300 hover:bg-white disabled:opacity-60"
            >
              <Crop size={14} /> Recadrer
            </button>
          )}
          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleRemove}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
            >
              <Trash2 size={14} /> Retirer
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickFile(f);
        }}
      />

      <AvatarCropDialog
        open={!!pendingFile}
        file={pendingFile}
        busy={busy}
        onCancel={() => {
          setPendingFile(null);
          if (inputRef.current) inputRef.current.value = "";
        }}
        onConfirm={handleCropped}
      />
    </div>
  );
}
