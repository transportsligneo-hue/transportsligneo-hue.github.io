import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Upload, Trash2, Download, Loader2, Eye } from "lucide-react";

const DOC_TYPES = [
  { value: "carte_grise", label: "Carte grise" },
  { value: "assurance", label: "Assurance" },
  { value: "bon_livraison", label: "Bon de livraison" },
  { value: "contrat", label: "Contrat" },
  { value: "photo", label: "Photo supplémentaire" },
  { value: "autre", label: "Autre" },
];

interface MissionDocument {
  id: string;
  type_document: string;
  nom_fichier: string;
  url_fichier: string;
  created_at: string;
  uploaded_by: string;
}

interface Props {
  attributionId: string;
  userId: string;
  isAdmin?: boolean;
}

export function MissionDocuments({ attributionId, userId, isAdmin = false }: Props) {
  const [documents, setDocuments] = useState<MissionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("autre");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from("mission_documents")
      .select("*")
      .eq("attribution_id", attributionId)
      .order("created_at", { ascending: false });
    setDocuments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [attributionId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert("Fichier trop volumineux (max 10 Mo)");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${attributionId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("mission-documents")
      .upload(path, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("mission-documents")
      .getPublicUrl(path);

    await supabase.from("mission_documents").insert({
      attribution_id: attributionId,
      type_document: selectedType,
      nom_fichier: file.name,
      url_fichier: path,
      uploaded_by: userId,
    });

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    fetchDocuments();
  };

  const handleDelete = async (doc: MissionDocument) => {
    if (!confirm(`Supprimer "${doc.nom_fichier}" ?`)) return;
    await supabase.storage.from("mission-documents").remove([doc.url_fichier]);
    await supabase.from("mission_documents").delete().eq("id", doc.id);
    fetchDocuments();
  };

  const handleDownload = async (doc: MissionDocument) => {
    const { data } = await supabase.storage
      .from("mission-documents")
      .createSignedUrl(doc.url_fichier, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const handlePreview = async (doc: MissionDocument) => {
    const { data } = await supabase.storage
      .from("mission-documents")
      .createSignedUrl(doc.url_fichier, 120);
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
  };

  const typeLabel = (val: string) => DOC_TYPES.find((d) => d.value === val)?.label || val;

  const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-heading text-primary tracking-wider uppercase flex items-center gap-2">
        <FileText size={16} /> Documents de mission
      </h3>

      {/* Upload zone */}
      <div className="flex flex-col gap-2 p-3 rounded border border-primary/20 bg-background/50">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-cream/50 block mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-background border border-primary/20 rounded px-2 py-1.5 text-xs text-cream"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs text-cream/50 block mb-1">Fichier (PDF, image)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
              onChange={handleUpload}
              className="w-full text-xs text-cream file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
              disabled={uploading}
            />
          </div>
        </div>
        {uploading && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <Loader2 className="animate-spin" size={14} /> Envoi en cours…
          </div>
        )}
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <p className="text-cream/40 text-xs">Aucun document ajouté.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5 rounded bg-card/50 border border-primary/10">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary mr-2">
                  {typeLabel(doc.type_document)}
                </span>
                <span className="text-xs text-cream truncate">{doc.nom_fichier}</span>
                <div className="text-[10px] text-cream/30 mt-0.5">
                  {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {isImage(doc.nom_fichier) && (
                  <button onClick={() => handlePreview(doc)} className="p-1.5 rounded hover:bg-primary/10 text-cream/50 hover:text-primary transition-colors" title="Aperçu">
                    <Eye size={14} />
                  </button>
                )}
                <button onClick={() => handleDownload(doc)} className="p-1.5 rounded hover:bg-primary/10 text-cream/50 hover:text-primary transition-colors" title="Télécharger">
                  <Download size={14} />
                </button>
                {(isAdmin || doc.uploaded_by === userId) && (
                  <button onClick={() => handleDelete(doc)} className="p-1.5 rounded hover:bg-destructive/10 text-cream/50 hover:text-destructive transition-colors" title="Supprimer">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="max-w-lg max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="Aperçu" className="rounded max-w-full" />
            <button onClick={() => setPreviewUrl(null)} className="mt-2 w-full py-2 bg-primary/20 text-primary text-xs rounded">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
