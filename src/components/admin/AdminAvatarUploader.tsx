import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmToast } from "@/lib/confirm-toast";

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;

interface Props {
  /** Utilisateur (auth) propriétaire de la photo. */
  ownerUserId: string | null;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}

/**
 * Permet à un admin d'importer / remplacer la photo de profil
 * d'un convoyeur ou d'un client qui n'y arrive pas lui-même.
 */
export function AdminAvatarUploader({ ownerUserId, value, onChange, label = "Photo de profil" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const disabled = !ownerUserId || busy;

  const handleFile = async (file: File) => {
    if (!ownerUserId) return;
    if (!ACCEPTED.includes(file.type)) return toast.error("Format non supporté (PNG, JPG, WEBP)");
    if (file.size > MAX_BYTES) return toast.error("Fichier trop volumineux (3 Mo max)");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${ownerUserId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("user_id", ownerUserId);
      if (upErr) throw upErr;
      onChange(data.publicUrl);
      toast.success("Photo de profil mise à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!ownerUserId || !value) return;
    if (!(await confirmToast("Supprimer la photo de profil ?"))) return;
    setBusy(true);
    try {
      const marker = "/avatars/";
      const idx = value.indexOf(marker);
      if (idx >= 0) await supabase.storage.from("avatars").remove([value.substring(idx + marker.length)]);
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", ownerUserId);
      if (error) throw error;
      onChange(null);
      toast.success("Photo supprimée");
    } catch (e) {
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
          {ownerUserId ? "PNG, JPG, WEBP · 3 Mo max" : "Aucun compte utilisateur lié"}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md bg-pro-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-pro-accent-hover disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {value ? "Changer" : "Importer"}
          </button>
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
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}
