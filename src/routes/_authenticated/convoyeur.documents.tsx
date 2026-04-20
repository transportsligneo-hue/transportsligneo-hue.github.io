import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef } from "react";
import { Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/documents")({
  component: ConvoyeurDocuments,
});

const DOC_TYPES_SALARIE = ["Permis de conduire", "Pièce d'identité", "Justificatif de domicile", "RIB"];
const DOC_TYPES_INDEPENDANT = [...DOC_TYPES_SALARIE, "KBIS", "Assurance RC professionnelle"];

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
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("convoyeur-documents").upload(path, file);
    if (uploadError) { console.error("Upload error:", uploadError); setUploading(false); return; }
    const { data: urlData } = await supabase.storage.from("convoyeur-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = urlData?.signedUrl || path;
    await supabase.from("documents_convoyeurs").insert({ convoyeur_id: convoyeurId, nom_fichier: file.name, type_document: selectedType, url_fichier: url });
    const { data } = await supabase.from("documents_convoyeurs").select("*").eq("convoyeur_id", convoyeurId).order("created_at", { ascending: false });
    setDocs(data || []);
    setUploading(false);
    setUploadSuccess(true);
    if (fileRef.current) fileRef.current.value = "";
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  const handleDelete = async (id: string, url: string) => {
    const match = url.match(/convoyeur-documents\/([^?]+)/);
    const path = match ? match[1] : null;
    if (path) await supabase.storage.from("convoyeur-documents").remove([path]);
    await supabase.from("documents_convoyeurs").delete().eq("id", id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const uploadedTypes = new Set(docs.map(d => d.type_document));
  const missingTypes = docTypes.filter(t => !uploadedTypes.has(t));
  const allComplete = missingTypes.length === 0;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl sm:text-2xl font-semibold text-pro-text">Mes documents</h1>

      {/* Completeness */}
      <div className={`p-4 rounded-xl border ${allComplete ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        <div className="flex items-center gap-2 mb-1">
          {allComplete ? <CheckCircle size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-amber-600" />}
          <span className={`text-sm font-medium ${allComplete ? "text-emerald-800" : "text-amber-800"}`}>
            {allComplete ? "Tous les documents requis sont envoyés" : `${missingTypes.length} document(s) manquant(s)`}
          </span>
        </div>
        {!allComplete && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {missingTypes.map(t => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="bg-white rounded-xl border border-pro-border p-5 space-y-4 shadow-sm">
        <p className="text-pro-text-soft text-sm font-medium">Uploadez vos documents justificatifs</p>
        {uploadSuccess && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm">
            <CheckCircle size={14} /> Document envoyé avec succès
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-white border border-pro-border rounded-lg px-3 py-2 text-pro-text text-sm focus:border-emerald-400 focus:outline-none"
          >
            {docTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            ref={fileRef}
            type="file"
            className="text-pro-text text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-pro-border file:bg-pro-bg-soft file:text-pro-text file:text-xs file:cursor-pointer"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Envoyer
          </button>
        </div>
      </div>

      {/* List */}
      {docs.length === 0 ? (
        <p className="text-pro-muted text-sm">Aucun document envoyé.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-pro-border p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={16} className="text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <a href={d.url_fichier} target="_blank" rel="noreferrer" className="text-pro-text text-sm hover:text-emerald-600 transition-colors truncate block">
                    {d.nom_fichier}
                  </a>
                  <p className="text-pro-muted text-xs">{d.type_document} · {new Date(d.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(d.id, d.url_fichier)} className="text-pro-muted hover:text-red-600 transition-colors shrink-0 ml-2">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
