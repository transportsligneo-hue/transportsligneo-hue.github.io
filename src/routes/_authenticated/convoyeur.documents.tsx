import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef } from "react";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/documents")({
  component: ConvoyeurDocuments,
});

const DOC_TYPES = ["Permis de conduire", "Carte d'identité", "Justificatif de domicile", "RIB", "Assurance", "Autre"];

function ConvoyeurDocuments() {
  const { user } = useAuth();
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Array<{ id: string; nom_fichier: string; type_document: string; url_fichier: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState(DOC_TYPES[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (conv) {
        setConvoyeurId(conv.id);
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
    if (!file || !convoyeurId) return;

    setUploading(true);
    const path = `${convoyeurId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("convoyeur-documents")
      .upload(path, file);

    if (uploadError) { setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("convoyeur-documents").getPublicUrl(path);

    await supabase.from("documents_convoyeurs").insert({
      convoyeur_id: convoyeurId,
      nom_fichier: file.name,
      type_document: selectedType,
      url_fichier: urlData.publicUrl,
    });

    const { data } = await supabase
      .from("documents_convoyeurs")
      .select("*")
      .eq("convoyeur_id", convoyeurId)
      .order("created_at", { ascending: false });
    setDocs(data || []);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (id: string, url: string) => {
    const path = url.split("/convoyeur-documents/")[1];
    if (path) await supabase.storage.from("convoyeur-documents").remove([path]);
    await supabase.from("documents_convoyeurs").delete().eq("id", id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Mes documents</h1>

      <div className="card-premium p-5 rounded space-y-4">
        <p className="text-cream/70 text-sm">Uploadez vos documents justificatifs</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none"
          >
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
                  <p className="text-cream text-sm">{d.nom_fichier}</p>
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
