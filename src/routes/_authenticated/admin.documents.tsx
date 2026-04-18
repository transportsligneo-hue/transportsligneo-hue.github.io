import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, RefreshCw, ChevronDown, ChevronUp, Eye, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  component: AdminDocuments,
});

interface Convoyeur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  type_convoyeur: string;
  statut: string;
}

interface Document {
  id: string;
  convoyeur_id: string;
  type_document: string;
  nom_fichier: string;
  url_fichier: string;
  created_at: string;
}

const DOC_LABELS: Record<string, string> = {
  permis: "Permis de conduire",
  identite: "Pièce d'identité",
  domicile: "Justificatif de domicile",
  rib: "RIB",
  kbis: "KBIS",
  assurance: "Assurance RC pro",
  autre: "Autre",
};

const REQUIRED_BASE = ["permis", "identite", "domicile", "rib"];
const REQUIRED_INDEP = ["kbis", "assurance"];

function AdminDocuments() {
  const [convoyeurs, setConvoyeurs] = useState<Convoyeur[]>([]);
  const [docsByConvoyeur, setDocsByConvoyeur] = useState<Record<string, Document[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "incomplets" | "valides">("all");
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [convRes, docsRes] = await Promise.all([
      supabase.from("convoyeurs").select("id, nom, prenom, email, type_convoyeur, statut").order("created_at", { ascending: false }),
      supabase.from("documents_convoyeurs").select("*").order("created_at", { ascending: false }),
    ]);
    if (convRes.data) setConvoyeurs(convRes.data as Convoyeur[]);
    if (docsRes.data) {
      const grouped: Record<string, Document[]> = {};
      for (const d of docsRes.data as Document[]) {
        if (!grouped[d.convoyeur_id]) grouped[d.convoyeur_id] = [];
        grouped[d.convoyeur_id].push(d);
      }
      setDocsByConvoyeur(grouped);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getMissingDocs = (c: Convoyeur): string[] => {
    const owned = new Set((docsByConvoyeur[c.id] || []).map(d => d.type_document));
    const required = c.type_convoyeur === "independant"
      ? [...REQUIRED_BASE, ...REQUIRED_INDEP]
      : REQUIRED_BASE;
    return required.filter(r => !owned.has(r));
  };

  const filtered = convoyeurs.filter(c => {
    const missing = getMissingDocs(c);
    if (filter === "incomplets") return missing.length > 0;
    if (filter === "valides") return missing.length === 0;
    return true;
  });

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("convoyeur-documents").createSignedUrl(path, 120);
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
  };

  const downloadDoc = async (path: string) => {
    const { data } = await supabase.storage.from("convoyeur-documents").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Documents convoyeurs</h1>
          <p className="text-cream/50 text-sm mt-1">{filtered.length} convoyeur{filtered.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none appearance-none">
            <option value="all">Tous</option>
            <option value="incomplets">Documents manquants</option>
            <option value="valides">Dossiers complets</option>
          </select>
          <button onClick={fetchAll} className="p-2 text-cream/50 hover:text-primary transition-colors"><RefreshCw size={16} /></button>
        </div>
      </div>

      {loading ? (
        <div className="card-premium p-8 rounded text-center text-cream/40">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="card-premium p-8 rounded text-center text-cream/40">Aucun convoyeur correspondant.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const docs = docsByConvoyeur[c.id] || [];
            const missing = getMissingDocs(c);
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="card-premium rounded">
                <button
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-colors"
                >
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-cream font-medium">{c.prenom} {c.nom}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${c.type_convoyeur === "independant" ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : "bg-blue-500/20 text-blue-300 border-blue-500/30"}`}>
                        {c.type_convoyeur === "independant" ? "Indépendant" : "Salarié"}
                      </span>
                      {missing.length > 0 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/30 inline-flex items-center gap-1">
                          <AlertCircle size={10} /> {missing.length} manquant{missing.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-green-500/20 text-green-300 border-green-500/30">
                          Dossier complet
                        </span>
                      )}
                    </div>
                    <div className="text-cream/40 text-xs mt-0.5">{c.email} · {docs.length} document{docs.length > 1 ? "s" : ""}</div>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-cream/50" /> : <ChevronDown size={16} className="text-cream/50" />}
                </button>

                {isOpen && (
                  <div className="border-t border-primary/10 p-4 space-y-3">
                    {missing.length > 0 && (
                      <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                        Manquants : {missing.map(m => DOC_LABELS[m] || m).join(", ")}
                      </div>
                    )}
                    {docs.length === 0 ? (
                      <p className="text-cream/40 text-xs">Aucun document envoyé.</p>
                    ) : (
                      <div className="space-y-2">
                        {docs.map((d) => (
                          <div key={d.id} className="flex items-center justify-between gap-2 p-2.5 rounded bg-card/50 border border-primary/10">
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary mr-2">
                                {DOC_LABELS[d.type_document] || d.type_document}
                              </span>
                              <span className="text-xs text-cream truncate">{d.nom_fichier}</span>
                              <div className="text-[10px] text-cream/30 mt-0.5">{new Date(d.created_at).toLocaleDateString("fr-FR")}</div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {isImage(d.nom_fichier) && (
                                <button onClick={() => openDoc(d.url_fichier)} className="p-1.5 rounded hover:bg-primary/10 text-cream/50 hover:text-primary transition-colors" title="Aperçu">
                                  <Eye size={14} />
                                </button>
                              )}
                              <button onClick={() => downloadDoc(d.url_fichier)} className="p-1.5 rounded hover:bg-primary/10 text-cream/50 hover:text-primary transition-colors" title="Télécharger">
                                <Download size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="max-w-2xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="Aperçu document" className="rounded max-w-full" />
            <button onClick={() => setPreviewUrl(null)} className="mt-2 w-full py-2 bg-primary/20 text-primary text-xs rounded inline-flex items-center justify-center gap-2">
              <FileText size={14} /> Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
