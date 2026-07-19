import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

interface LogoUploaderProps {
  /** Folder name in the bucket · must be the auth user's id for RLS. */
  ownerUserId: string;
  /** Current public URL (or null). */
  value: string | null;
  /** Called with the new public URL (or null after removal). */
  onChange: (url: string | null) => Promise<void> | void;
  /** Visual variant for light vs dark surfaces. */
  variant?: "light" | "dark";
  label?: string;
}

export function LogoUploader({
  ownerUserId,
  value,
  onChange,
  variant = "light",
  label = "Logo entreprise",
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const isDark = variant === "dark";
  const wrapCls = isDark
    ? "border border-primary/20 bg-navy/40 rounded p-4"
    : "border border-slate-200 bg-slate-50 rounded-md p-4";
  const textCls = isDark ? "text-cream" : "text-slate-700";
  const mutedCls = isDark ? "text-cream/50" : "text-slate-500";
  const btnPrimary = isDark
    ? "inline-flex items-center gap-2 px-4 py-2 bg-primary text-navy text-xs uppercase tracking-wider font-heading hover:bg-gold-light transition-colors disabled:opacity-60"
    : "inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-pro-accent text-white text-sm font-medium hover:bg-pro-accent-hover disabled:opacity-60";
  const btnGhost = isDark
    ? "inline-flex items-center gap-2 px-3 py-2 border border-primary/20 text-cream/70 text-xs hover:border-destructive/40 hover:text-destructive transition-colors"
    : "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200";

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non supporté (PNG, JPG ou WEBP uniquement)");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Fichier trop volumineux (2 Mo max)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${ownerUserId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
      await onChange(data.publicUrl);
      toast.success("Logo mis à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    if (!(await confirmToast("Supprimer le logo ?"))) return;
    setUploading(true);
    try {
      // Extract storage path from public URL (after /company-logos/)
      const marker = "/company-logos/";
      const idx = value.indexOf(marker);
      if (idx >= 0) {
        const path = value.substring(idx + marker.length);
        await supabase.storage.from("company-logos").remove([path]);
      }
      await onChange(null);
      toast.success("Logo supprimé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={wrapCls}>
      <div className="flex items-center gap-4">
        <div
          className={`shrink-0 w-20 h-20 rounded-md flex items-center justify-center overflow-hidden ${
            isDark ? "bg-navy border border-primary/15" : "bg-white border border-slate-200"
          }`}
        >
          {value ? (
            <img src={value} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <ImageIcon size={28} className={mutedCls} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${textCls}`}>{label}</p>
          <p className={`text-xs mt-0.5 ${mutedCls}`}>PNG, JPG, WEBP · 2 Mo max</p>
          <div className="flex flex-wrap gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className={btnPrimary}
            >
              {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
              {value ? "Changer" : "Importer"}
            </button>
            {value && (
              <button type="button" onClick={handleRemove} disabled={uploading} className={btnGhost}>
                <Trash2 size={14} /> Retirer
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
