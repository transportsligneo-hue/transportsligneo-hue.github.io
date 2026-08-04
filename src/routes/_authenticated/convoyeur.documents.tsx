import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Upload, FileText, Loader2, CheckCircle, AlertCircle, Eye, RotateCcw,
  User as UserIcon, Camera,
} from "lucide-react";
import { toast } from "sonner";
import {
  getVisibleConvoyeurDocTypes,
  isConvoyeurDocApproved,
  normalizeConvoyeurDocType,
} from "@/lib/convoyeur-documents";

/** Nettoie le nom de fichier : Supabase Storage refuse accents/espaces/caractères spéciaux. */
function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
  return cleaned.slice(-80) || "fichier";
}


export const Route = createFileRoute("/_authenticated/convoyeur/documents")({
  component: ConvoyeurDocuments,
});

interface DocRow {
  id: string;
  nom_fichier: string;
  type_document: string;
  url_fichier: string;
  statut_validation: string;
  motif_refus: string | null;
  created_at: string;
}

function statutBadge(s: string) {
  if (isConvoyeurDocApproved(s)) return { label: "Approuvé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle };
  if (s === "refuse") return { label: "Refusé", cls: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle };
  return { label: "En attente", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Loader2 };
}

function ConvoyeurDocuments() {
  const { user } = useAuth();
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [typeConvoyeur, setTypeConvoyeur] = useState<string>("independant");
  const [docs, setDocs] = useState<Record<string, DocRow>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const avatarRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async (cId: string) => {
    const { data } = await supabase
      .from("documents_convoyeurs")
      .select("*")
      .eq("convoyeur_id", cId)
      .order("created_at", { ascending: false });
    const map: Record<string, DocRow> = {};
    (data || []).forEach((d: DocRow) => {
      // garde le plus récent par type
      const normalized = normalizeConvoyeurDocType(d.type_document);
      if (!map[normalized]) map[normalized] = d;
    });
    setDocs(map);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id, type_convoyeur")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!conv) { setLoading(false); return; }
      setConvoyeurId(conv.id);
      setTypeConvoyeur(conv.type_convoyeur || "independant");
      await reload(conv.id);
      const { data: prof } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setAvatarUrl((prof as { avatar_url?: string | null } | null)?.avatar_url ?? null);
      setLoading(false);
    })();
  }, [user, reload]);

  const handleUpload = async (spec: { key: string }, file: File) => {
    if (!user) return;
    if (!convoyeurId) {
      toast.error("Votre fiche convoyeur n'est pas encore créée. Contactez le support.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (15 Mo maximum).");
      return;
    }
    setUploadingKey(spec.key);
    try {
      const path = `${user.id}/${spec.key}_${Date.now()}_${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("convoyeur-documents")
        .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;

      // Replace previous of same type
      const previous = docs[spec.key];
      if (previous) {
        await supabase.from("documents_convoyeurs").delete().eq("id", previous.id);
      }
      const { error: insErr } = await supabase.from("documents_convoyeurs").insert({
        convoyeur_id: convoyeurId,
        nom_fichier: file.name,
        type_document: spec.key,
        url_fichier: path,
        statut_validation: "en_attente",
      });
      if (insErr) throw insErr;
      await reload(convoyeurId);
      toast.success("Document envoyé");
    } catch (err) {
      console.error("[convoyeur.documents] upload", err);
      toast.error(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleAvatar = async (file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Photo trop volumineuse (8 Mo maximum).");
      return;
    }
    setUploadingKey("__avatar");
    try {
      const path = `${user.id}/avatar_${Date.now()}_${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("user_id", user.id);
      if (updErr) throw updErr;
      setAvatarUrl(pub.publicUrl);
      toast.success("Photo de profil mise à jour");
    } catch (err) {
      console.error("[convoyeur.documents] avatar", err);
      toast.error(err instanceof Error ? err.message : "Envoi de la photo impossible");
    } finally {
      setUploadingKey(null);
    }
  };


  const openPreview = async (d: DocRow) => {
    if (d.url_fichier.startsWith("http")) { setPreviewUrl(d.url_fichier); return; }
    const { data } = await supabase.storage.from("convoyeur-documents").createSignedUrl(d.url_fichier, 300);
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>;

  const visibleDocs = getVisibleConvoyeurDocTypes(typeConvoyeur);
  const requiredCount = visibleDocs.filter(d => d.required).length;
  const validatedCount = visibleDocs.filter(d => d.required && isConvoyeurDocApproved(docs[d.key]?.statut_validation)).length;

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-pro-text">Mes documents</h1>
        <p className="text-pro-text-soft text-xs mt-0.5">
          Téléversez et tenez à jour vos pièces officielles.
        </p>
      </div>

      {/* Photo de profil */}
      <div className="bg-white rounded-2xl border border-pro-border p-4 sm:p-5 flex items-center gap-4 shadow-sm">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <UserIcon size={26} className="text-emerald-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-pro-text">Photo de profil</p>
          <p className="text-xs text-pro-text-soft">JPG ou PNG. Visible par l'admin et les clients.</p>
        </div>
        <label className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs rounded-lg cursor-pointer hover:bg-emerald-700 font-medium shrink-0">
          {uploadingKey === "__avatar" ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          Modifier
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAvatar(f);
            }}
          />
        </label>
      </div>

      {/* Avancement */}
      <div className={`p-4 rounded-xl border ${
        validatedCount === requiredCount
          ? "bg-emerald-50 border-emerald-200"
          : "bg-amber-50 border-amber-200"
      }`}>
        <div className="flex items-center gap-2">
          {validatedCount === requiredCount
            ? <CheckCircle size={16} className="text-emerald-600" />
            : <AlertCircle size={16} className="text-amber-600" />}
          <p className="text-sm font-medium text-pro-text">
            {validatedCount}/{requiredCount} documents requis validés
          </p>
        </div>
      </div>

      {/* Liste fixe */}
      <div className="space-y-3">
        {visibleDocs.map((spec) => {
          const d = docs[spec.key];
          const badge = d ? statutBadge(d.statut_validation) : null;
          const Icon = badge?.icon ?? FileText;
          const isUploading = uploadingKey === spec.key;
          return (
            <div key={spec.key} className="bg-white rounded-xl border border-pro-border p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  d ? badge!.cls : "bg-pro-bg-soft text-pro-muted border-pro-border"
                } border`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-pro-text">{spec.label}</p>
                    {spec.required && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Requis</span>}
                  </div>
                  {spec.hint && <p className="text-xs text-pro-muted mt-0.5">{spec.hint}</p>}
                  {d && (
                    <p className="text-xs text-pro-text-soft mt-1 truncate">
                      {d.nom_fichier} · {new Date(d.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  {d && badge && (
                    <span className={`inline-flex items-center gap-1 mt-2 text-[11px] px-2 py-0.5 rounded-full border ${badge.cls}`}>
                      <Icon size={11} /> {badge.label}
                    </span>
                  )}
                  {d?.statut_validation === "refuse" && d.motif_refus && (
                    <p className="text-xs text-red-700 mt-1">Motif : {d.motif_refus}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {d && (
                    <button
                      onClick={() => openPreview(d)}
                      className="p-2 hover:bg-pro-bg-soft rounded-lg text-pro-text-soft border border-pro-border"
                      title="Aperçu"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  <label className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg cursor-pointer font-medium ${
                    d ? "bg-white border border-pro-border text-pro-text hover:bg-pro-bg-soft" : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}>
                    {isUploading ? <Loader2 size={13} className="animate-spin" /> : (d ? <RotateCcw size={13} /> : <Upload size={13} />)}
                    {d ? "Remplacer" : "Envoyer"}
                    <input
                      ref={(el) => { fileRefs.current[spec.key] = el; }}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(spec, f);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="max-w-3xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            {/\.pdf(\?|$)/i.test(previewUrl) ? (
              <iframe src={previewUrl} className="w-[90vw] h-[80vh] rounded-lg bg-white" title="Aperçu PDF" />
            ) : (
              <img src={previewUrl} alt="Aperçu" className="rounded-lg max-w-full" />
            )}
            <button
              onClick={() => setPreviewUrl(null)}
              className="mt-3 w-full py-2.5 bg-white text-pro-text rounded-xl text-sm font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
