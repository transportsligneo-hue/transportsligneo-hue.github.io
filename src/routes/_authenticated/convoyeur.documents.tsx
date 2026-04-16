import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef } from "react";
import { Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/documents")({
  component: ConvoyeurDocuments,
});

const DOC_TYPES_SALARIE = [
  "Permis de conduire",
  "Pièce d'identité",
  "Justificatif de domicile",
  "RIB",
];
const DOC_TYPES_INDEPENDANT = [
  ...DOC_TYPES_SALARIE,
  "KBIS",
  "Assurance RC professionnelle",
];

function ConvoyeurDocuments() {
  const { user } = useAuth();
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [typeConvoyeur, setTypeConvoyeur] = useState<string>("salarie");
  const [docs, setDocs] = useState<Array<{ id: string; nom_fichier: string; type_document: string; url_fichier: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("Permis de conduire");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const docTypes = typeConvoyeur === "independant" ? DOC_TYPES_INDEPENDANT : DOC_TYPES_SALARIE;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id, type_convoyeur")
        .eq("user_id", user.id)
        .maybeSingle();

      if (conv) {
        setConvoyeurId(conv.id);
        setTypeConvoyeur((conv as any).type_convoyeur || "salarie");
        const { data } = await supabase
          .from("documents_convoyeurs")
          .select("*")
          .eq("convoyeur_id", conv.id)
          .order("created_at", { ascending: false });
        setDocs(data || []);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !convoyeurId || !user) return;

    setUploading(true);
    setUploadSuccess(false);
    // Use user.id as folder to match storage RLS policy
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("convoyeur-documents")
      .upload(path, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      setUploading(false);
      return;
    }

    // Use signed URL since bucket is private
    const { data: urlData } = await supabase.storage
      .from("convoyeur-documents")
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

    const url = urlData?.signedUrl || path;

    await supabase.from("documents_convoyeurs").insert({
      convoyeur_id: convoyeurId,
      nom_fichier: file.name,
      type_document: selectedType,
      url_fichier: url,
    });

    const { data } = await supabase
      .from("documents_convoyeurs")
      .select("*")
      .eq("convoyeur_id", convoyeurId)
      .order("created_at", { ascending: false });
    setDocs(data || []);
    setUploading(false);
    setUploadSuccess(true);
    if (fileRef.current) fileRef.current.value = "";
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  const handleDelete = async (id: string, url: string) => {
    // Extract path from signed URL or direct path
    const match = url.match(/convoyeur-documents\/([^?]+)/);
    const path = match ? match[1] : null;
    if (path) await supabase.storage.from("convoyeur-documents").remove([path]);
    await supabase.from("documents_convoyeurs").delete().eq("id", id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  // Check completeness
  const uploadedTypes = new Set(docs.map(d => d.type_document));
  const requiredTypes = docTypes;
  const missingTypes = requiredTypes.filter(t => !uploadedTypes.has(t));
  const allComplete = missingTypes.length === 0;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Mes documents</h1>

      {/* Completeness indicator */}
      <div className={`p-4 rounded border ${allComplete ? "bg-green-500/10 border-green-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
        <div className="flex items-center gap-2 mb-2">
          {allComplete ? <CheckCircle size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-amber-400" />}
          <span className={`text-sm font-medium ${allComplete ? "text-green-300" : "text-amber-300"}`}>
            {allComplete ? "Tous les documents requis sont envoyés" : `${missingTypes.length} document(s) manquant(s)`}
          </span>
        </div>
        {!allComplete && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {missingTypes.map(t => (
              <span key={t} className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/20">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="card-premium p-5 rounded space-y-4">
        <p className="text-cream/70 text-sm">Uploadez vos documents justificatifs</p>
        {uploadSuccess && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle size={14} /> Document envoyé avec succès
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none"
          >
            {docTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input ref={fileRef} type="file" className="text-cream text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-primary/20 file:text-primary file:text-xs file:cursor-pointer" />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary text-sm rounded hover:bg-primary/30 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Envoyer
          </button>
        </div>
      </div>

      {docs.length === 0 ? (
        <p className="text-cream/50 text-sm">Aucun document envoyé.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="card-premium p-4 rounded flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-primary" />
                <div>
                  <a href={d.url_fichier} target="_blank" rel="noreferrer" className="text-cream text-sm hover:text-primary transition-colors">
                    {d.nom_fichier}
                  </a>
                  <p className="text-cream/40 text-xs">{d.type_document} · {new Date(d.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(d.id, d.url_fichier)} className="text-cream/30 hover:text-destructive transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
