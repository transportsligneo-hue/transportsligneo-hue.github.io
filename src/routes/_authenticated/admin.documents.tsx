import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  FolderOpen,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  Button,
  IconButton,
  Select,
} from "@/components/admin/AdminUI";

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
  statut_validation?: string;
  motif_refus?: string | null;
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
      supabase
        .from("convoyeurs")
        .select("id, nom, prenom, email, type_convoyeur, statut")
        .order("created_at", { ascending: false }),
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

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getMissingDocs = (c: Convoyeur): string[] => {
    const owned = new Set((docsByConvoyeur[c.id] || []).map((d) => d.type_document));
    const required =
      c.type_convoyeur === "independant" ? [...REQUIRED_BASE, ...REQUIRED_INDEP] : REQUIRED_BASE;
    return required.filter((r) => !owned.has(r));
  };

  const getBlockingIssues = (c: Convoyeur): string[] => {
    const docs = docsByConvoyeur[c.id] || [];
    const required =
      c.type_convoyeur === "independant" ? [...REQUIRED_BASE, ...REQUIRED_INDEP] : REQUIRED_BASE;
    const issues: string[] = [];
    for (const r of required) {
      const doc = docs.find((d) => d.type_document === r);
      if (!doc) issues.push(`${DOC_LABELS[r]} manquant`);
      else if (doc.statut_validation === "refuse") issues.push(`${DOC_LABELS[r]} refusé`);
      else if (doc.statut_validation !== "approuve") issues.push(`${DOC_LABELS[r]} non validé`);
    }
    return issues;
  };

  const filtered = convoyeurs.filter((c) => {
    const blocking = getBlockingIssues(c);
    if (filter === "incomplets") return blocking.length > 0;
    if (filter === "valides") return blocking.length === 0;
    return true;
  });

  const validateDoc = async (docId: string, statut: "approuve" | "refuse", motif?: string) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("documents_convoyeurs")
      .update({
        statut_validation: statut,
        motif_refus: statut === "refuse" ? motif || null : null,
        valide_par: u.user?.id,
        valide_le: new Date().toISOString(),
      } as never)
      .eq("id", docId);
    await fetchAll();
  };

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
    <div>
      <PageHeader
        title="Documents convoyeurs"
        subtitle={`${filtered.length} convoyeur${filtered.length > 1 ? "s" : ""}`}
        actions={
          <>
            <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">Tous</option>
              <option value="incomplets">Documents manquants</option>
              <option value="valides">Dossiers complets</option>
            </Select>
            <IconButton onClick={fetchAll} title="Actualiser">
              <RefreshCw size={15} />
            </IconButton>
          </>
        }
      />

      {loading ? (
        <Card className="text-center text-pro-muted py-12">Chargement…</Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Aucun convoyeur" description="Aucun convoyeur ne correspond à ce filtre." />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const docs = docsByConvoyeur[c.id] || [];
            const missing = getMissingDocs(c);
            const blocking = getBlockingIssues(c);
            const isOpen = expanded === c.id;
            const isIndependant = c.type_convoyeur === "independant";
            return (
              <Card key={c.id} padded={false}>
                <button
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-pro-bg-soft/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-pro-text">
                        {c.prenom} {c.nom}
                      </span>
                      <Badge tone={isIndependant ? "purple" : "info"}>
                        {isIndependant ? "Indépendant" : "Salarié"}
                      </Badge>
                      {blocking.length > 0 ? (
                        <Badge tone="warning" icon={<AlertCircle size={10} />}>
                          {isIndependant ? "Activation bloquée" : `${blocking.length} à valider`}
                        </Badge>
                      ) : (
                        <Badge tone="success" icon={<CheckCircle2 size={10} />}>
                          Tous validés
                        </Badge>
                      )}
                    </div>
                    <p className="text-pro-muted text-xs mt-1">
                      {c.email} · {docs.length} document{docs.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronUp size={16} className="text-pro-muted shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-pro-muted shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-pro-border p-4 space-y-3">
                    {isIndependant && blocking.length > 0 && (
                      <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
                        <div className="font-semibold mb-1 inline-flex items-center gap-1">
                          <XCircle size={12} /> Activation indépendant bloquée
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 opacity-90">
                          {blocking.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!isIndependant && missing.length > 0 && (
                      <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
                        Manquants : {missing.map((m) => DOC_LABELS[m] || m).join(", ")}
                      </div>
                    )}
                    {docs.length === 0 ? (
                      <p className="text-pro-muted text-sm">Aucun document envoyé.</p>
                    ) : (
                      <div className="space-y-2">
                        {docs.map((d) => {
                          const statut = d.statut_validation || "en_attente";
                          const tone =
                            statut === "approuve"
                              ? "success"
                              : statut === "refuse"
                                ? "danger"
                                : "warning";
                          const icon =
                            statut === "approuve" ? (
                              <CheckCircle2 size={10} />
                            ) : statut === "refuse" ? (
                              <XCircle size={10} />
                            ) : (
                              <Clock size={10} />
                            );
                          const statutLabel =
                            statut === "approuve"
                              ? "Approuvé"
                              : statut === "refuse"
                                ? "Refusé"
                                : "En attente";
                          return (
                            <div key={d.id} className="p-3 rounded-md bg-pro-bg-soft/50 border border-pro-border space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge tone="primary">{DOC_LABELS[d.type_document] || d.type_document}</Badge>
                                    <Badge tone={tone} icon={icon}>
                                      {statutLabel}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-pro-text truncate mt-1">{d.nom_fichier}</p>
                                  <p className="text-xs text-pro-muted mt-0.5">
                                    {new Date(d.created_at).toLocaleDateString("fr-FR")}
                                  </p>
                                  {statut === "refuse" && d.motif_refus && (
                                    <p className="text-xs text-red-600 mt-1 italic">
                                      Motif : {d.motif_refus}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {isImage(d.nom_fichier) && (
                                    <IconButton
                                      onClick={() => openDoc(d.url_fichier)}
                                      title="Aperçu"
                                      tone="primary"
                                    >
                                      <Eye size={14} />
                                    </IconButton>
                                  )}
                                  <IconButton
                                    onClick={() => downloadDoc(d.url_fichier)}
                                    title="Télécharger"
                                    tone="primary"
                                  >
                                    <Download size={14} />
                                  </IconButton>
                                </div>
                              </div>
                              <div className="flex gap-2 pt-2 border-t border-pro-border">
                                <Button
                                  size="sm"
                                  variant="success"
                                  className="flex-1"
                                  disabled={statut === "approuve"}
                                  onClick={() => validateDoc(d.id, "approuve")}
                                  icon={<CheckCircle2 size={12} />}
                                >
                                  Approuver
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className="flex-1"
                                  disabled={statut === "refuse"}
                                  onClick={() => {
                                    const motif = window.prompt("Motif du refus (facultatif) :") ?? "";
                                    validateDoc(d.id, "refuse", motif);
                                  }}
                                  icon={<XCircle size={12} />}
                                >
                                  Refuser
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="bg-white rounded-xl p-3 max-w-2xl max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={previewUrl} alt="Aperçu document" className="rounded-md max-w-full" />
            <Button className="w-full mt-2" variant="secondary" onClick={() => setPreviewUrl(null)} icon={<FileText size={14} />}>
              Fermer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
