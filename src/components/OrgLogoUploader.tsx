import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { OrgLogo } from "@/components/OrgLogo";

const BUCKET = "organization-logos";
const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 Mo

interface Props {
  /** UUID de l'organisation. Utilisé comme dossier de stockage (RLS). */
  organizationId: string;
  /** Nom affiché pour les initiales de fallback. */
  organizationName?: string | null;
  /** URL courante (org.logo_url). */
  value: string | null;
  /** Appelé après update réussi de `organizations.logo_url`. */
  onChange: (url: string | null) => void;
  /** Cache la carte parente (rendu inline). */
  compact?: boolean;
}

export function OrgLogoUploader({ organizationId, organizationName, value, onChange, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non supporté (PNG, JPG, WEBP ou SVG)");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Fichier trop volumineux (2 Mo max)");
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${organizationId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upErr) throw upErr;
      // Bucket privé : on stocke une URL signée longue durée (10 ans).
      const { data, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 3650);
      if (signErr) throw signErr;
      const publicUrl = data.signedUrl;
      const { error: updErr } = await supabase
        .from("organizations")
        .update({ logo_url: publicUrl } as never)
        .eq("id", organizationId);
      if (updErr) throw updErr;
      onChange(publicUrl);
      toast.success("Logo mis à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    if (!(await confirmToast("Supprimer le logo de l'organisation ?"))) return;
    setBusy(true);
    try {
      const marker = `/${BUCKET}/`;
      const idx = value.indexOf(marker);
      if (idx >= 0) {
        const path = value.substring(idx + marker.length).split("?")[0]!;
        await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]);
      }
      await supabase
        .from("organizations")
        .update({ logo_url: null } as never)
        .eq("id", organizationId);
      onChange(null);
      toast.success("Logo supprimé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        compact
          ? "flex items-center gap-4"
          : "v3-card p-5 flex items-center gap-4"
      }
    >
      <OrgLogo name={organizationName} url={value} size={72} />
      <div className="flex-1 min-w-0">
        <p className="font-v3-display font-semibold text-v3 text-sm">Logo de l'organisation</p>
        <p className="text-v3-muted text-xs mt-0.5">PNG, JPG, WEBP ou SVG · 2 Mo max · affiché sur vos documents</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-v3-blue text-white text-xs font-medium hover:brightness-110 transition disabled:opacity-60 shadow-v3"
          >
            {busy ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
            {value ? "Changer" : "Importer"}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-v3 text-v3-muted text-xs hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition"
            >
              <Trash2 size={13} /> Retirer
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
