import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Mail, Phone, FileText, ArrowRightCircle, Eye, MapPin, Car, Calendar, User, Archive, ArchiveRestore, PenLine, History, FileSpreadsheet, XCircle } from "lucide-react";
import { generateDevisPdf, downloadDevisPdf, devisRowToPdfData, type DevisData } from "@/lib/devis-pdf";
import { ValidateDevisButton } from "@/components/admin/ValidateDevisButton";
import { SendDocumentByEmail } from "@/components/admin/SendDocumentByEmail";
import {
  PageHeader,
  Card,
  KpiCard,
  Badge,
  EmptyState,
  Button,
  IconButton,
  Select,
  SearchInput,
  devisStatutTone,
} from "@/components/admin/AdminUI";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import { InspectionPreuvesBlock } from "@/components/admin/drawers/InspectionPreuvesBlock";
import { LogoLoader } from "@/components/brand/LogoLoader";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { convertDevisToMission } from "@/lib/admin-devis-conversion.functions";
import { RefusDialog } from "@/components/admin/RefusDialog";

export const Route = createFileRoute("/_authenticated/admin/devis")({
  component: AdminDevisPage,
});

interface DevisRow {
  id: string;
  numero: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  depart: string;
  arrivee: string;
  distance_km: number | null;
  duree_estimee: string | null;
  type_vehicule: string | null;
  marque: string | null;
  modele: string | null;
  carburant: string | null;
  prestation: string | null;
  option_trajet: string | null;
  date_souhaitee: string | null;
  heure_souhaitee: string | null;
  prix_estime: number;
  tarif_label: string | null;
  multiplier_label: string | null;
  message: string | null;
  statut: string;
  email_envoye: boolean;
  created_at: string;
  mission_id: string | null;
  converted_at: string | null;
  vin: string | null;
  carte_grise_recto_url: string | null;
  carte_grise_verso_url: string | null;
  vehicule_docs_completed: boolean;
  version: number | null;
  locked_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  archived_at: string | null;
  paid_at: string | null;
}

interface AcceptationInfo {
  devis_id: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  signature_url: string | null;
  pdf_url: string | null;
  montant_accepte: number | null;
  devis_version: number | null;
}

interface HistoryRow {
  id: string;
  old_statut: string | null;
  new_statut: string;
  created_at: string;
}

const STATUTS = [
  { value: "brouillon", label: "Brouillon" },
  { value: "genere", label: "Généré" },
  { value: "envoye", label: "Envoyé" },
  { value: "en_attente", label: "En attente d'acceptation" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "expire", label: "Expiré" },
  { value: "convertit", label: "Transformé en mission" },
];

const SORTS = [
  { value: "date_desc", label: "Plus récents" },
  { value: "date_asc", label: "Plus anciens" },
  { value: "montant_desc", label: "Montant ↓" },
  { value: "montant_asc", label: "Montant ↑" },
  { value: "numero", label: "Numéro" },
];

function statutLabel(s: string): string {
  return STATUTS.find((x) => x.value === s)?.label ?? s;
}

function isExpired(d: DevisRow): boolean {
  if (d.statut === "expire") return true;
  if (!d.expires_at || d.paid_at || d.locked_at) return false;
  return ["genere", "envoye", "en_attente"].includes(d.statut) && new Date(d.expires_at) < new Date();
}

function AdminDevisPage() {
  const convertDevis = useServerFn(convertDevisToMission);
  const [selected, setSelected] = useState<DevisRow | null>(null);
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [acceptations, setAcceptations] = useState<Record<string, AcceptationInfo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [showArchived, setShowArchived] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const handleConvert = async (row: DevisRow) => {
    if (row.mission_id) {
      toast.info("Devis déjà converti", { description: `Mission ${row.mission_id.slice(0, 8)}…` });
      return;
    }
    if (!(await confirmToast(`Convertir le devis ${row.numero} en mission ?`))) return;
    setConvertingId(row.id);
    try {
      const mission = await convertDevis({ data: { devisId: row.id } });

      toast.success(mission.alreadyConverted ? "Devis déjà converti" : "Mission créée", {
        description: `${mission.numero} depuis ${row.numero}`,
      });
      setDevis((d) =>
        d.map((x) =>
          x.id === row.id
            ? { ...x, statut: "convertit", mission_id: mission.missionId, converted_at: new Date().toISOString() }
            : x
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error("Échec conversion", { description: msg });
    } finally {
      setConvertingId(null);
    }
  };

  const load = async () => {
    setLoading(true);
    const [dRes, aRes] = await Promise.all([
      supabase.from("devis").select("*").order("created_at", { ascending: false }),
      supabase
        .from("devis_acceptations")
        .select("devis_id, accepted_at, ip_address, user_agent, signature_url, pdf_url, montant_accepte, devis_version")
        .order("created_at", { ascending: false }),
    ]);
    if (dRes.error) {
      toast.error("Chargement des devis impossible", { description: dRes.error.message });
    }
    setDevis((dRes.data as DevisRow[]) || []);
    const map: Record<string, AcceptationInfo> = {};
    ((aRes.data ?? []) as AcceptationInfo[]).forEach((a) => {
      if (!map[a.devis_id]) map[a.devis_id] = a;
    });
    setAcceptations(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Realtime : signature / statut d'un devis se met à jour instantanément côté admin.
  useEffect(() => {
    const channel = supabase
      .channel("admin-devis-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devis" },
        () => { load(); },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "devis_acceptations" },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("devis").update({ statut }).eq("id", id);
    if (error) {
      toast.error("Mise à jour impossible", { description: error.message });
      return;
    }
    setDevis((d) => d.map((x) => (x.id === id ? { ...x, statut } : x)));
  };

  const handleArchive = async (row: DevisRow) => {
    const archiving = !row.archived_at;
    if (archiving && !(await confirmToast(`Archiver le devis ${row.numero} ? Il restera consultable (les devis ne sont jamais supprimés).`))) return;
    const archived_at = archiving ? new Date().toISOString() : null;
    const { error } = await supabase.from("devis").update({ archived_at }).eq("id", row.id);
    if (error) {
      toast.error("Action impossible", { description: error.message });
      return;
    }
    setDevis((d) => d.map((x) => (x.id === row.id ? { ...x, archived_at } : x)));
    toast.success(archiving ? "Devis archivé" : "Devis restauré");
  };

  const handleDownload = async (row: DevisRow) => {
    setGeneratingId(row.id);
    try {
      // PDF figé signé en priorité
      const acc = acceptations[row.id];
      if (acc?.pdf_url) {
        const { data: signed } = await supabase.storage.from("devis-acceptes").createSignedUrl(acc.pdf_url, 300);
        if (signed?.signedUrl) {
          window.open(signed.signedUrl, "_blank");
          return;
        }
      }
      const data: DevisData = devisRowToPdfData(row as unknown as Record<string, unknown>);
      const blob = await generateDevisPdf(data);
      downloadDevisPdf(blob, row.numero);
    } finally {
      setGeneratingId(null);
    }
  };

  const exportCsv = () => {
    const sep = ";";
    const head = ["Numero", "Client", "Email", "Telephone", "Date", "Depart", "Arrivee", "Montant TTC", "Statut", "Version", "Signe", "Date acceptation", "IP acceptation"].join(sep);
    const rows = filtered.map((d) => {
      const acc = acceptations[d.id];
      return [
        d.numero,
        `${d.prenom} ${d.nom}`.trim(),
        d.email,
        d.telephone ?? "",
        new Date(d.created_at).toLocaleDateString("fr-FR"),
        `"${d.depart.replaceAll('"', "'")}"`,
        `"${d.arrivee.replaceAll('"', "'")}"`,
        Number(d.prix_estime).toFixed(2),
        statutLabel(isExpired(d) ? "expire" : d.statut),
        String(d.version ?? 1),
        d.locked_at ? "Oui" : "Non",
        acc?.accepted_at ? new Date(acc.accepted_at).toLocaleString("fr-FR") : "",
        acc?.ip_address ?? "",
      ].join(sep);
    });
    const csv = "\uFEFF" + [head, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `devis-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = devis
    .filter((d) => {
      if (!showArchived && d.archived_at) return false;
      if (showArchived && !d.archived_at) return false;
      const effective = isExpired(d) ? "expire" : d.statut;
      if (statutFilter && effective !== statutFilter) return false;
      if (dateFrom && new Date(d.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(d.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        d.numero.toLowerCase().includes(q) ||
        d.nom.toLowerCase().includes(q) ||
        d.prenom.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.depart.toLowerCase().includes(q) ||
        d.arrivee.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      switch (sort) {
        case "date_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "montant_desc": return Number(b.prix_estime) - Number(a.prix_estime);
        case "montant_asc": return Number(a.prix_estime) - Number(b.prix_estime);
        case "numero": return a.numero.localeCompare(b.numero);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const totalAmount = filtered.reduce((s, d) => s + Number(d.prix_estime || 0), 0);
  const acceptes = filtered.filter((d) => d.statut === "accepte" || d.statut === "convertit").length;
  const signes = filtered.filter((d) => !!d.locked_at).length;

  return (
    <div>
      <PageHeader
        title="Devis"
        subtitle="Cycle de vie complet — les devis ne disparaissent jamais (archivage uniquement)."
        actions={
          <Link to="/admin/nouveau-devis">
            <Button icon={<PenLine size={14} />}>Créer un devis</Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total" value={filtered.length} icon={FileText} />
        <KpiCard
          label="Montant cumulé"
          value={`${totalAmount.toLocaleString("fr-FR")} €`}
          tone="success"
        />
        <KpiCard label="Acceptés" value={acceptes} tone="success" />
        <KpiCard label="Signés" value={signes} tone="info" />
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par numéro, client, email, ville..."
        />
        <Select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="lg:w-56">
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="lg:w-44">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-5 text-xs">
        <label className="flex items-center gap-2 text-pro-text-soft">
          Du
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent border border-pro-border rounded px-2 py-1.5 text-pro-text" />
        </label>
        <label className="flex items-center gap-2 text-pro-text-soft">
          Au
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent border border-pro-border rounded px-2 py-1.5 text-pro-text" />
        </label>
        <label className="flex items-center gap-2 text-pro-text-soft cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-pro-accent" />
          Voir les archivés
        </label>
        <Button size="sm" onClick={exportCsv} icon={<FileSpreadsheet size={12} />} className="ml-auto">
          Export CSV
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LogoLoader label="Chargement des devis…" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun devis" description={showArchived ? "Aucun devis archivé." : "Aucun devis ne correspond à ces filtres."} />
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const effective = isExpired(d) ? "expire" : d.statut;
            const acc = acceptations[d.id];
            return (
              <Card key={d.id}>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono text-pro-accent text-sm font-semibold">
                        {d.numero}
                      </span>
                      {(d.version ?? 1) > 1 && <Badge tone="neutral">v{d.version}</Badge>}
                      <Badge tone={devisStatutTone[effective] ?? "neutral"}>{statutLabel(effective)}</Badge>
                      {d.locked_at && <Badge tone="success">✍ Signé</Badge>}
                      {d.paid_at && <Badge tone="success">Payé</Badge>}
                      {d.email_envoye && <Badge tone="info">Email envoyé</Badge>}
                      {d.mission_id && <Badge tone="info">Mission créée</Badge>}
                      {d.archived_at && <Badge tone="neutral">Archivé</Badge>}
                      <span className="text-pro-text-soft text-xs">
                        {new Date(d.created_at).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-pro-text font-medium">
                      {d.prenom} {d.nom}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-pro-text-soft mt-1">
                      <span className="flex items-center gap-1">
                        <Mail size={12} />
                        {d.email}
                      </span>
                      {d.telephone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {d.telephone}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-pro-text-soft uppercase tracking-wider mb-0.5 text-[10px] font-semibold">
                          Trajet
                        </p>
                        <p className="text-pro-text font-medium">
                          {d.depart} → {d.arrivee}
                        </p>
                      </div>
                      <div>
                        <p className="text-pro-text-soft uppercase tracking-wider mb-0.5 text-[10px] font-semibold">
                          Distance
                        </p>
                        <p className="text-pro-text font-medium">{d.distance_km ?? "—"} km</p>
                      </div>
                      <div>
                        <p className="text-pro-text-soft uppercase tracking-wider mb-0.5 text-[10px] font-semibold">
                          Option
                        </p>
                        <p className="text-pro-text font-medium capitalize">{d.option_trajet}</p>
                      </div>
                      <div>
                        <p className="text-pro-text-soft uppercase tracking-wider mb-0.5 text-[10px] font-semibold">
                          Véhicule
                        </p>
                        <p className="text-pro-text font-medium">
                          {[d.marque, d.modele].filter(Boolean).join(" ") || d.type_vehicule || "—"}
                        </p>
                      </div>
                    </div>

                    {acc && (
                      <p className="mt-2 text-[11px] text-emerald-600 flex items-center gap-1.5">
                        <PenLine size={11} />
                        Signé le {new Date(acc.accepted_at).toLocaleString("fr-FR")} · IP {acc.ip_address ?? "—"} · {Number(acc.montant_accepte ?? d.prix_estime).toFixed(2)} € TTC
                      </p>
                    )}

                    {d.message && (
                      <p className="mt-3 text-xs italic text-pro-text-soft border-l-2 border-pro-accent/30 pl-3">
                        "{d.message}"
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-pro-text">{d.prix_estime} €</p>
                      <p className="text-[10px] text-pro-text-soft uppercase tracking-wider font-medium">TTC</p>
                    </div>

                    <Select
                      value={d.statut}
                      onChange={(e) => updateStatut(d.id, e.target.value)}
                      className="text-xs py-1.5"
                    >
                      {STATUTS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>

                    <div className="flex gap-2 flex-wrap justify-end">
                      <IconButton title="Voir le détail" tone="primary" onClick={() => setSelected(d)}>
                        <Eye size={14} />
                      </IconButton>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(d)}
                        disabled={generatingId === d.id}
                        icon={
                          generatingId === d.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Download size={12} />
                          )
                        }
                      >
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleConvert(d)}
                        disabled={convertingId === d.id || !!d.mission_id}
                        icon={
                          convertingId === d.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ArrowRightCircle size={12} />
                          )
                        }
                      >
                        {d.mission_id ? "Converti" : "→ Mission"}
                      </Button>
                      <IconButton
                        onClick={() => handleArchive(d)}
                        title={d.archived_at ? "Restaurer" : "Archiver (jamais supprimé)"}
                        tone={d.archived_at ? "primary" : "danger"}
                      >
                        {d.archived_at ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                      </IconButton>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <DevisDrawer
        devis={selected}
        acceptation={selected ? acceptations[selected.id] ?? null : null}
        onClose={() => setSelected(null)}
        onDownload={handleDownload}
        onConvert={handleConvert}
        onArchive={(d) => { handleArchive(d); setSelected(null); }}
        onPriceSaved={(updated) => {
          setDevis((rows) => rows.map((row) => row.id === updated.id ? updated : row));
          setSelected(updated);
        }}
        onRefused={(id) => {
          const now = new Date().toISOString();
          setDevis((rows) => rows.map((row) => row.id === id ? { ...row, statut: "refuse", refused_at: now } as DevisRow : row));
          setSelected(null);
        }}
        onValidated={(id) => {
          const now = new Date().toISOString();
          setDevis((rows) => rows.map((row) => row.id === id ? { ...row, statut: "accepte", locked_at: now } : row));
          setSelected((cur) => cur && cur.id === id ? { ...cur, statut: "accepte", locked_at: now } : cur);
        }}
      />
    </div>
  );
}

function DevisDrawer({
  devis,
  acceptation,
  onClose,
  onDownload,
  onConvert,
  onArchive,
  onPriceSaved,
  onValidated,
  onRefused,
}: {
  devis: DevisRow | null;
  acceptation: AcceptationInfo | null;
  onClose: () => void;
  onDownload: (d: DevisRow) => void;
  onConvert: (d: DevisRow) => void;
  onArchive: (d: DevisRow) => void;
  onPriceSaved: (d: DevisRow) => void;
  onValidated: (id: string) => void;
  onRefused: (id: string) => void;
}) {
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [proofUrls, setProofUrls] = useState<{ signature: string | null; pdf: string | null }>({ signature: null, pdf: null });
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [refusOpen, setRefusOpen] = useState(false);

  useEffect(() => {
    if (!devis) return;
    let cancelled = false;
    setHistory(null);
    setProofUrls({ signature: null, pdf: null });
    setPriceInput(String(devis.prix_estime ?? ""));
    (async () => {
      const { data } = await supabase
        .from("devis_status_history")
        .select("id, old_statut, new_statut, created_at")
        .eq("devis_id", devis.id)
        .order("created_at", { ascending: false });
      if (!cancelled) setHistory((data ?? []) as HistoryRow[]);

      if (acceptation) {
        const next: { signature: string | null; pdf: string | null } = { signature: null, pdf: null };
        if (acceptation.signature_url) {
          const { data: s } = await supabase.storage.from("devis-acceptes").createSignedUrl(acceptation.signature_url, 600);
          next.signature = s?.signedUrl ?? null;
        }
        if (acceptation.pdf_url) {
          const { data: p } = await supabase.storage.from("devis-acceptes").createSignedUrl(acceptation.pdf_url, 600);
          next.pdf = p?.signedUrl ?? null;
        }
        if (!cancelled) setProofUrls(next);
      }
    })();
    return () => { cancelled = true; };
  }, [devis, acceptation]);

  if (!devis) return null;
  const savePriceAndRegenerate = async () => {
    const amount = Number(priceInput.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Saisis un montant valide");
      return;
    }
    setSavingPrice(true);
    try {
      const { error } = await supabase
        .from("devis")
        .update({ prix_estime: amount, prix_manuel: true, prix_aller: null, prix_retour: null } as never)
        .eq("id", devis.id);
      if (error) throw error;
      const updated = { ...devis, prix_estime: amount };
      onPriceSaved(updated);
      await onDownload(updated);
      toast.success("Prix modifié et PDF régénéré", { description: `${amount.toFixed(2)} € TTC` });
    } catch (error) {
      toast.error("Impossible de modifier le prix", {
        description: error instanceof Error ? error.message : "Erreur inconnue",
      });
    } finally {
      setSavingPrice(false);
    }
  };
  const effective = isExpired(devis) ? "expire" : devis.statut;
  return (
    <AdminDetailDrawer
      open={!!devis}
      onClose={onClose}
      title={devis.numero}
      subtitle={`${devis.prenom} ${devis.nom}`}
      badge={
        <div className="flex flex-wrap gap-2">
          <DrawerBadge tone="blue">{statutLabel(effective)}</DrawerBadge>
          {(devis.version ?? 1) > 1 && <DrawerBadge tone="amber">v{devis.version}</DrawerBadge>}
          {devis.locked_at && <DrawerBadge tone="green">✍ Signé</DrawerBadge>}
          {devis.email_envoye && <DrawerBadge tone="green">Email envoyé</DrawerBadge>}
          {devis.mission_id && <DrawerBadge tone="amber">Mission créée</DrawerBadge>}
        </div>
      }
      footer={
        <div className="flex flex-wrap gap-2">
          <ValidateDevisButton
            devisId={devis.id}
            numero={devis.numero}
            locked={!!devis.locked_at}
            onValidated={() => onValidated(devis.id)}
          />
          <Button size="sm" onClick={() => onDownload(devis)} icon={<Download size={12} />}>PDF</Button>
          <Button size="sm" onClick={() => onConvert(devis)} disabled={!!devis.mission_id} icon={<ArrowRightCircle size={12} />}>
            {devis.mission_id ? "Converti" : "→ Mission"}
          </Button>
          {!devis.mission_id && devis.statut !== "refuse" && devis.statut !== "annule" && (
            <Button size="sm" onClick={() => setRefusOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white" icon={<XCircle size={12} />}>
              Refuser le devis
            </Button>
          )}
          <Button size="sm" onClick={() => onArchive(devis)} className="ml-auto" icon={devis.archived_at ? <ArchiveRestore size={12} /> : <Archive size={12} />}>
            {devis.archived_at ? "Restaurer" : "Archiver"}
          </Button>
        </div>
      }
    >
      <RefusDialog
        type="devis"
        id={devis.id}
        label={`${devis.numero} · ${devis.prenom} ${devis.nom}`}
        open={refusOpen}
        onClose={() => setRefusOpen(false)}
        onDone={() => { setRefusOpen(false); onRefused(devis.id); }}
      />

      <DrawerSection title="Client" icon={<User size={12} />}>
        <DrawerGrid>
          <DrawerField label="Nom" value={`${devis.prenom} ${devis.nom}`} />
          <DrawerField label="Email" value={devis.email} />
          <DrawerField label="Téléphone" value={devis.telephone} />
          <DrawerField label="Créé le" value={new Date(devis.created_at).toLocaleString("fr-FR")} />
        </DrawerGrid>
      </DrawerSection>

      <DrawerSection title="Acceptation & signature" icon={<PenLine size={12} />}>
        {acceptation ? (
          <div className="space-y-3">
            <DrawerGrid>
              <DrawerField label="Accepté le" value={new Date(acceptation.accepted_at).toLocaleString("fr-FR")} />
              <DrawerField label="Adresse IP" value={acceptation.ip_address ?? "—"} mono />
              <DrawerField label="Montant accepté" value={`${Number(acceptation.montant_accepte ?? devis.prix_estime).toFixed(2)} € TTC`} />
              <DrawerField label="Version signée" value={`v${acceptation.devis_version ?? 1}`} />
            </DrawerGrid>
            {acceptation.user_agent && (
              <p className="text-[10px] text-white/40 break-all">UA : {acceptation.user_agent}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {proofUrls.signature && (
                <a href={proofUrls.signature} target="_blank" rel="noopener noreferrer" className="block rounded border border-white/10 overflow-hidden hover:border-blue-400/50 transition bg-white">
                  <img src={proofUrls.signature} alt="Signature client" className="h-16 object-contain" />
                  <p className="text-[10px] text-center text-black/60 py-0.5">Signature</p>
                </a>
              )}
              {proofUrls.pdf && (
                <a href={proofUrls.pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-white/15 text-white/80 text-xs hover:border-blue-400/50 transition">
                  <FileText size={12} /> PDF figé signé
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-white/50">Pas encore accepté ni signé par le client.</p>
        )}
      </DrawerSection>

      <DrawerSection title="Trajet" icon={<MapPin size={12} />}>
        <DrawerGrid>
          <DrawerField label="Départ" value={devis.depart} />
          <DrawerField label="Arrivée" value={devis.arrivee} />
          <DrawerField label="Distance" value={devis.distance_km ? `${devis.distance_km} km` : null} />
          <DrawerField label="Durée estimée" value={devis.duree_estimee} />
          <DrawerField label="Option" value={devis.option_trajet} />
          <DrawerField label="Prestation" value={devis.prestation} />
        </DrawerGrid>
      </DrawerSection>

      <DrawerSection title="Véhicule" icon={<Car size={12} />}>
        <DrawerGrid>
          <DrawerField label="Type" value={devis.type_vehicule} />
          <DrawerField label="Marque" value={devis.marque} />
          <DrawerField label="Modèle" value={devis.modele} />
          <DrawerField label="Carburant" value={devis.carburant} />
          <DrawerField label="VIN" value={devis.vin} mono />
          <DrawerField
            label="Documents"
            value={
              devis.vehicule_docs_completed ? (
                <DrawerBadge tone="green">Complétés par le client</DrawerBadge>
              ) : (
                <DrawerBadge tone="amber">En attente client</DrawerBadge>
              )
            }
          />
        </DrawerGrid>
        {(devis.carte_grise_recto_url || devis.carte_grise_verso_url) && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-white/45 mb-2">Carte grise</p>
            <CarteGriseLinks recto={devis.carte_grise_recto_url} verso={devis.carte_grise_verso_url} />
          </div>
        )}
      </DrawerSection>

      <DrawerSection title="Planification" icon={<Calendar size={12} />}>
        <DrawerGrid>
          <DrawerField label="Date souhaitée" value={devis.date_souhaitee ? new Date(devis.date_souhaitee).toLocaleDateString("fr-FR") : null} />
          <DrawerField label="Heure" value={devis.heure_souhaitee} />
          <DrawerField label="Validité" value={devis.expires_at ? `jusqu'au ${new Date(devis.expires_at).toLocaleDateString("fr-FR")}` : null} />
          <DrawerField label="Tarif" value={devis.tarif_label} />
        </DrawerGrid>
      </DrawerSection>

      <DrawerSection title="Tarification">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs uppercase tracking-wider text-white/50">Prix estimé TTC</span>
          <span className="text-3xl font-semibold text-white">{Number(devis.prix_estime).toFixed(2)} €</span>
        </div>
        {devis.locked_at ? (
          <p className="mt-3 text-xs text-white/50">Ce devis est signé : son montant est verrouillé.</p>
        ) : (
          <div className="mt-4 border-t border-white/10 pt-4">
            <label htmlFor={`devis-price-${devis.id}`} className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/60">
              Modifier le prix TTC
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <input
                  id={`devis-price-${devis.id}`}
                  value={priceInput}
                  onChange={(event) => setPriceInput(event.target.value)}
                  inputMode="decimal"
                  aria-label="Nouveau prix TTC"
                  className="h-10 w-full rounded-md border border-white/20 bg-white px-3 pr-9 text-sm font-semibold text-slate-950 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">€</span>
              </div>
              <Button
                size="sm"
                onClick={savePriceAndRegenerate}
                disabled={savingPrice}
                icon={savingPrice ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              >
                {savingPrice ? "Régénération…" : "Modifier et régénérer"}
              </Button>
            </div>
          </div>
        )}
      </DrawerSection>

      <DrawerSection title="Historique" icon={<History size={12} />}>
        {history === null ? (
          <Loader2 className="animate-spin text-white/40" size={16} />
        ) : history.length === 0 ? (
          <p className="text-xs text-white/50">Aucun événement enregistré.</p>
        ) : (
          <div className="space-y-1.5">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5">
                <span className="text-white/80">
                  {h.old_statut ? `${statutLabel(h.old_statut)} → ${statutLabel(h.new_statut)}` : `Créé (${statutLabel(h.new_statut)})`}
                </span>
                <span className="text-white/40">{new Date(h.created_at).toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        )}
      </DrawerSection>

      <InspectionPreuvesBlock
        attributionId={null}
        fallbackCarteGriseRecto={devis.carte_grise_recto_url}
        fallbackCarteGriseVerso={devis.carte_grise_verso_url}
        fallbackVin={devis.vin}
      />

      <DrawerSection title="Envoi au client" icon={<User size={12} />}>
        <SendDocumentByEmail
          kind="devis"
          variant="dark"
          numero={devis.numero}
          documentId={devis.id}
          defaultEmail={devis.email}
          buildPdf={() =>
            generateDevisPdf(devisRowToPdfData(devis as unknown as Record<string, unknown>))
          }
          templateData={{
            prenom: devis.prenom,
            nom: devis.nom,
            depart: devis.depart,
            arrivee: devis.arrivee,
            distance: devis.distance_km,
            prix: Number(devis.prix_estime).toFixed(2),
            optionTrajet: devis.option_trajet,
          }}
        />
      </DrawerSection>

      {devis.message && (
        <DrawerSection title="Message client">
          <p className="text-sm italic text-white/80">"{devis.message}"</p>
        </DrawerSection>
      )}

    </AdminDetailDrawer>
  );
}

function CarteGriseLinks({ recto, verso }: { recto: string | null; verso: string | null }) {
  const [urls, setUrls] = useState<{ recto: string | null; verso: string | null }>({ recto: null, verso: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: { recto: string | null; verso: string | null } = { recto: null, verso: null };
      if (recto) {
        const { data } = await supabase.storage.from("cartes-grises").createSignedUrl(recto, 600);
        if (data?.signedUrl) next.recto = data.signedUrl;
      }
      if (verso) {
        const { data } = await supabase.storage.from("cartes-grises").createSignedUrl(verso, 600);
        if (data?.signedUrl) next.verso = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    })();
    return () => { cancelled = true; };
  }, [recto, verso]);

  return (
    <div className="grid grid-cols-2 gap-2">
      {(["recto", "verso"] as const).map((k) => {
        const url = urls[k];
        const path = k === "recto" ? recto : verso;
        if (!path) return <div key={k} className="rounded border border-white/10 bg-white/5 p-3 text-center text-[11px] text-white/40">{k} non fourni</div>;
        return (
          <a key={k} href={url ?? "#"} target="_blank" rel="noopener noreferrer" className="block rounded border border-white/10 overflow-hidden hover:border-blue-400/50 transition">
            {url ? <img src={url} alt={`Carte grise ${k}`} className="w-full h-32 object-cover" /> : <div className="h-32 flex items-center justify-center text-white/30 text-xs">Chargement…</div>}
            <p className="text-[10px] text-center text-white/60 py-1 capitalize">{k}</p>
          </a>
        );
      })}
    </div>
  );
}
