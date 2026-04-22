import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle,
  Camera, Receipt, IdCard, Search, Eye, Download,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/documents")({
  component: ConvoyeurDocuments,
});

const DOC_TYPES_SALARIE = ["Permis de conduire", "Pièce d'identité", "Justificatif de domicile", "RIB"];
const DOC_TYPES_INDEPENDANT = [...DOC_TYPES_SALARIE, "KBIS", "Assurance RC professionnelle"];

type Category = "all" | "perso" | "mission" | "photos";

interface ConvoyeurDoc {
  id: string;
  nom_fichier: string;
  type_document: string;
  url_fichier: string;
  created_at: string;
  source: "perso";
}

interface MissionDoc {
  id: string;
  nom_fichier: string;
  type_document: string;
  url_fichier: string;
  created_at: string;
  attribution_id: string;
  source: "mission" | "photos";
}

type AnyDoc = ConvoyeurDoc | MissionDoc;

function isPhotoFile(name: string) {
  return /\.(jpe?g|png|gif|webp|heic)$/i.test(name);
}

function ConvoyeurDocuments() {
  const { user } = useAuth();
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [typeConvoyeur, setTypeConvoyeur] = useState<string>("salarie");
  const [persoDocs, setPersoDocs] = useState<ConvoyeurDoc[]>([]);
  const [missionDocs, setMissionDocs] = useState<MissionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("Permis de conduire");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

      if (!conv) { setLoading(false); return; }
      setConvoyeurId(conv.id);
      setTypeConvoyeur(conv.type_convoyeur || "salarie");

      const { data: perso } = await supabase
        .from("documents_convoyeurs")
        .select("*")
        .eq("convoyeur_id", conv.id)
        .order("created_at", { ascending: false });
      setPersoDocs((perso || []).map(d => ({ ...d, source: "perso" as const })));

      // Mission docs : récupérer toutes les attributions du convoyeur puis leurs docs
      const { data: attrs } = await supabase
        .from("attributions")
        .select("id")
        .eq("convoyeur_id", conv.id);
      const attrIds = (attrs || []).map(a => a.id);
      if (attrIds.length > 0) {
        const { data: mdocs } = await supabase
          .from("mission_documents")
          .select("*")
          .in("attribution_id", attrIds)
          .order("created_at", { ascending: false });
        setMissionDocs((mdocs || []).map(d => ({
          ...d,
          source: isPhotoFile(d.nom_fichier) || d.type_document === "photo" ? "photos" : "mission",
        })));
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
    await supabase.from("documents_convoyeurs").insert({
      convoyeur_id: convoyeurId,
      nom_fichier: file.name,
      type_document: selectedType,
      url_fichier: url,
    });
    const { data } = await supabase.from("documents_convoyeurs").select("*").eq("convoyeur_id", convoyeurId).order("created_at", { ascending: false });
    setPersoDocs((data || []).map(d => ({ ...d, source: "perso" as const })));
    setUploading(false);
    setUploadSuccess(true);
    if (fileRef.current) fileRef.current.value = "";
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  const handleDeletePerso = async (id: string, url: string) => {
    if (!confirm("Supprimer ce document ?")) return;
    const match = url.match(/convoyeur-documents\/([^?]+)/);
    const path = match ? match[1] : null;
    if (path) await supabase.storage.from("convoyeur-documents").remove([path]);
    await supabase.from("documents_convoyeurs").delete().eq("id", id);
    setPersoDocs(prev => prev.filter(d => d.id !== id));
  };

  const handlePreview = async (doc: AnyDoc) => {
    const bucket = doc.source === "perso" ? "convoyeur-documents" : "mission-documents";
    // For perso docs, url_fichier is already a signed URL
    if (doc.source === "perso" && doc.url_fichier.startsWith("http")) {
      setPreviewUrl(doc.url_fichier);
      return;
    }
    const { data } = await supabase.storage.from(bucket).createSignedUrl(doc.url_fichier, 120);
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
  };

  const handleDownload = async (doc: AnyDoc) => {
    if (doc.source === "perso" && doc.url_fichier.startsWith("http")) {
      window.open(doc.url_fichier, "_blank");
      return;
    }
    const bucket = doc.source === "perso" ? "convoyeur-documents" : "mission-documents";
    const { data } = await supabase.storage.from(bucket).createSignedUrl(doc.url_fichier, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const allDocs: AnyDoc[] = useMemo(() => [...persoDocs, ...missionDocs], [persoDocs, missionDocs]);

  const filtered = useMemo(() => {
    let list = allDocs;
    if (category === "perso") list = list.filter(d => d.source === "perso");
    if (category === "mission") list = list.filter(d => d.source === "mission");
    if (category === "photos") list = list.filter(d => d.source === "photos");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.nom_fichier.toLowerCase().includes(q) ||
        d.type_document.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allDocs, category, search]);

  const counts = useMemo(() => ({
    perso: persoDocs.length,
    mission: missionDocs.filter(d => d.source === "mission").length,
    photos: missionDocs.filter(d => d.source === "photos").length,
  }), [persoDocs, missionDocs]);

  const uploadedTypes = new Set(persoDocs.map(d => d.type_document));
  const missingTypes = docTypes.filter(t => !uploadedTypes.has(t));
  const allComplete = missingTypes.length === 0;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>;

  const cats: { key: Category; label: string; count?: number; icon: typeof FileText }[] = [
    { key: "all", label: "Tous", icon: FileText, count: allDocs.length },
    { key: "perso", label: "Personnels", icon: IdCard, count: counts.perso },
    { key: "mission", label: "Mission", icon: Receipt, count: counts.mission },
    { key: "photos", label: "Photos", icon: Camera, count: counts.photos },
  ];

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-pro-text">Mes documents</h1>
        <p className="text-pro-text-soft text-xs mt-0.5">
          Centralisez vos pièces personnelles et tous les justificatifs de mission
        </p>
      </div>

      {/* Statut completude personnels */}
      <div className={`p-4 rounded-xl border ${allComplete ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        <div className="flex items-center gap-2 mb-1">
          {allComplete ? <CheckCircle size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-amber-600" />}
          <span className={`text-sm font-medium ${allComplete ? "text-emerald-800" : "text-amber-800"}`}>
            {allComplete ? "Tous les documents personnels sont envoyés" : `${missingTypes.length} document(s) personnel(s) manquant(s)`}
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

      {/* Upload personnel */}
      <div className="bg-white rounded-xl border border-pro-border p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-emerald-600" />
          <p className="text-pro-text text-sm font-semibold">Ajouter un document personnel</p>
        </div>
        {uploadSuccess && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm">
            <CheckCircle size={14} /> Document envoyé avec succès
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
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
            className="flex-1 text-pro-text text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-pro-border file:bg-pro-bg-soft file:text-pro-text file:text-xs file:cursor-pointer"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Envoyer
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un document…"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-pro-border rounded-xl text-sm placeholder:text-pro-muted focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {cats.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition ${
                category === c.key
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-white border-pro-border text-pro-text hover:bg-pro-bg-soft"
              }`}
            >
              <c.icon size={18} />
              <span className="text-xs font-medium">{c.label}</span>
              {c.count !== undefined && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  category === c.key ? "bg-white/20" : "bg-pro-bg-soft"
                }`}>{c.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-pro-border p-8 text-center shadow-sm">
          <FileText size={32} className="mx-auto text-pro-muted mb-3" />
          <p className="text-pro-text-soft text-sm">
            {search || category !== "all" ? "Aucun document pour ces critères." : "Aucun document pour le moment."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <div key={`${d.source}-${d.id}`} className="bg-white rounded-xl border border-pro-border p-3 sm:p-4 flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                d.source === "perso" ? "bg-blue-50 text-blue-600" :
                d.source === "photos" ? "bg-amber-50 text-amber-600" :
                "bg-emerald-50 text-emerald-600"
              }`}>
                {d.source === "perso" ? <IdCard size={18} /> :
                 d.source === "photos" ? <Camera size={18} /> :
                 <Receipt size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-pro-text text-sm font-medium truncate">{d.nom_fichier}</p>
                <p className="text-pro-muted text-xs">
                  <span className="font-medium">{d.type_document}</span>
                  {" · "}{new Date(d.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {isPhotoFile(d.nom_fichier) && (
                  <button
                    onClick={() => handlePreview(d)}
                    className="p-2 hover:bg-pro-bg-soft rounded-lg text-pro-text-soft"
                    title="Aperçu"
                  >
                    <Eye size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleDownload(d)}
                  className="p-2 hover:bg-pro-bg-soft rounded-lg text-pro-text-soft"
                  title="Télécharger"
                >
                  <Download size={16} />
                </button>
                {d.source === "perso" && (
                  <button
                    onClick={() => handleDeletePerso(d.id, d.url_fichier)}
                    className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-pro-text-soft"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="max-w-2xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="Aperçu" className="rounded-lg max-w-full" />
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
