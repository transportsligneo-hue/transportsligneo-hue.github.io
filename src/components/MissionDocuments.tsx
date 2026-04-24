import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import { FileText, Upload, Trash2, Download, Loader2, Eye, FileCheck2, FilePenLine, CarFront, MoreHorizontal, PenLine, X, CheckCircle2 } from "lucide-react";

const DOC_TYPES = [
  { value: "pv_livraison", label: "PV de livraison / restitution", short: "PV", icon: FileCheck2 },
  { value: "contrat", label: "Contrat", short: "Contrat", icon: FilePenLine },
  { value: "carte_grise", label: "Carte grise (CG)", short: "CG", icon: CarFront },
  { value: "autre", label: "Autre", short: "Autre", icon: MoreHorizontal },
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

const typeLabel = (val: string) => {
  if (val === "pv_signature") return "Signature PV";
  return DOC_TYPES.find((d) => d.value === val)?.label || val;
};

const typeShort = (val: string) => {
  if (val === "pv_signature") return "Signature";
  return DOC_TYPES.find((d) => d.value === val)?.short || val;
};

const typeIcon = (val: string) => {
  if (val === "pv_signature") return PenLine;
  return DOC_TYPES.find((d) => d.value === val)?.icon || FileText;
};

const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

export function MissionDocuments({ attributionId, userId, isAdmin = false }: Props) {
  const [documents, setDocuments] = useState<MissionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedType, setSelectedType] = useState("pv_livraison");
  const [preview, setPreview] = useState<{ url: string; name: string; image: boolean } | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
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

  const notifyAdmin = async (doc: { name: string; type: string }) => {
    try {
      await sendTransactionalEmail({
        templateName: "document-mission-admin",
        recipientEmail: "contact@transportsligneo.fr",
        idempotencyKey: `mission-doc-${attributionId}-${doc.type}-${doc.name}-${Date.now()}`,
        templateData: {
          attributionId,
          documentName: doc.name,
          documentType: typeLabel(doc.type),
          uploadedAt: new Date().toLocaleString("fr-FR"),
        },
      });
    } catch (err) {
      console.warn("Notification admin document non bloquante:", err);
    }
  };

  const uploadFile = async (file: File, forcedType?: string) => {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Fichier trop volumineux (max 10 Mo)");
      return;
    }

    const documentType = forcedType || selectedType;
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${attributionId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("mission-documents")
      .upload(path, file, { contentType: file.type || undefined });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("mission_documents").insert({
      attribution_id: attributionId,
      type_document: documentType,
      nom_fichier: file.name,
      url_fichier: path,
      uploaded_by: userId,
    });

    if (insertError) {
      console.error("Document insert error:", insertError);
      setUploading(false);
      return;
    }

    await notifyAdmin({ name: file.name, type: documentType });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    fetchDocuments();
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDelete = async (doc: MissionDocument) => {
    if (!confirm(`Supprimer "${doc.nom_fichier}" ?`)) return;
    await supabase.storage.from("mission-documents").remove([doc.url_fichier]);
    await supabase.from("mission_documents").delete().eq("id", doc.id);
    fetchDocuments();
  };

  const signedUrl = async (doc: MissionDocument, expires = 120) => {
    const { data } = await supabase.storage
      .from("mission-documents")
      .createSignedUrl(doc.url_fichier, expires);
    return data?.signedUrl || null;
  };

  const handleDownload = async (doc: MissionDocument) => {
    const url = await signedUrl(doc, 60);
    if (url) window.open(url, "_blank");
  };

  const handlePreview = async (doc: MissionDocument) => {
    const url = await signedUrl(doc, 180);
    if (url) setPreview({ url, name: doc.nom_fichier, image: isImage(doc.nom_fichier) });
  };

  const handleSignature = async (file: File) => {
    setSignatureOpen(false);
    await uploadFile(file, "pv_signature");
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-emerald-600" size={22} /></div>;
  }

  return (
    <div className="space-y-5 text-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950 flex items-center gap-2">
            <FileText size={18} className="text-emerald-600" /> Documents de mission
          </h3>
          <p className="text-xs text-slate-500 mt-1">Ajoutez les pièces utiles, elles sont liées automatiquement à la mission.</p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          {documents.length} doc{documents.length > 1 ? "s" : ""}
        </span>
      </div>

      {!isAdmin && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <label className="text-xs font-semibold text-slate-600">Type de document</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DOC_TYPES.map((type) => {
                const Icon = type.icon;
                const active = selectedType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setSelectedType(type.value)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${active ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                  >
                    <Icon size={14} /> {type.short}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSignatureOpen(true)}
            className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] sm:min-w-44"
          >
            <PenLine size={18} /> Signer le PV
          </button>
        </div>
      )}

      {!isAdmin && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`rounded-3xl border-2 border-dashed bg-white p-5 text-center shadow-sm transition ${dragActive ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            {uploading ? <Loader2 className="animate-spin" size={22} /> : <Upload size={22} />}
          </div>
          <p className="text-sm font-semibold text-slate-950">Déposez un fichier ici</p>
          <p className="mt-1 text-xs text-slate-500">PDF ou image, 10 Mo maximum</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 sm:w-auto"
          >
            {uploading ? "Envoi en cours…" : "Ajouter un document"}
          </button>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 shadow-sm">
          Aucun document ajouté pour cette mission.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {documents.map((doc) => {
            const Icon = typeIcon(doc.type_document);
            return (
              <article key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        {typeShort(doc.type_document)}
                      </span>
                      <span className="text-[11px] text-slate-400">{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-950">{doc.nom_fichier}</p>
                    <p className="text-xs text-slate-500">{typeLabel(doc.type_document)}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => handlePreview(doc)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Voir">
                    <Eye size={14} /> Voir
                  </button>
                  {(isAdmin || doc.uploaded_by === userId) ? (
                    <button onClick={() => handleDelete(doc)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-100" title="Supprimer">
                      <Trash2 size={14} /> Supprimer
                    </button>
                  ) : (
                    <button onClick={() => handleDownload(doc)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Télécharger">
                      <Download size={14} /> Télécharger
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {signatureOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-xl rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-950">Signature du PV</h4>
                <p className="text-xs text-slate-500">Le convoyeur signe directement à l’écran.</p>
              </div>
              <button onClick={() => setSignatureOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <SignatureCanvas onValidate={handleSignature} disabled={uploading} />
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-950">{preview.name}</p>
              <button onClick={() => setPreview(null)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer"><X size={18} /></button>
            </div>
            {preview.image ? (
              <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full rounded-xl object-contain" />
            ) : (
              <div className="rounded-xl bg-slate-50 p-6 text-center">
                <CheckCircle2 className="mx-auto text-emerald-600" size={32} />
                <p className="mt-2 text-sm text-slate-600">Document prêt à être ouvert.</p>
                <a href={preview.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Ouvrir le document</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
