import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileWarning,
  Link2,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

import {
  getPoPdfUrl,
  linkPoToDevis,
  listBonsCommande,
  retryPoMatch,
  runGmailPoSync,
  searchDevisForPo,
  setPoVin,
  unlinkPo,
  type PoRow,
} from "@/lib/po/po-admin.functions";
import { normalizeVin } from "@/lib/vin";
import { EmptyState } from "@/components/admin/AdminUI";
import { LogoLoader } from "@/components/brand/LogoLoader";

export const Route = createFileRoute("/_authenticated/admin/bons-commande")({
  component: BonsCommandePage,
  head: () => ({
    meta: [
      { title: "Bons de commande — Administration Ligneo" },
      { name: "description", content: "Import automatique et rapprochement des bons de commande clients (PO)." },
    ],
  }),
});

type TabKey = "rapproche" | "non_rapproche" | "ambigu" | "erreur_extraction";

const TABS: { key: TabKey; label: string; icon: typeof CheckCircle2; tone: string }[] = [
  { key: "rapproche", label: "Rapprochés", icon: CheckCircle2, tone: "green" },
  { key: "non_rapproche", label: "En attente", icon: Clock, tone: "orange" },
  { key: "ambigu", label: "À valider manuellement", icon: AlertTriangle, tone: "violet" },
  { key: "erreur_extraction", label: "Erreurs d'extraction", icon: FileWarning, tone: "red" },
];

type DevisSearchRow = {
  id: string; numero: string; nom: string; prenom: string;
  depart: string; arrivee: string; prix_estime: number; statut: string; vin: string | null; created_at: string;
};

function BonsCommandePage() {
  const [rows, setRows] = useState<PoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<TabKey>("non_rapproche");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listBonsCommande());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { rapproche: 0, non_rapproche: 0, ambigu: 0, erreur_extraction: 0 };
    for (const r of rows) c[r.statut] = (c[r.statut] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = rows.filter((r) => r.statut === tab);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await runGmailPoSync();
      toast.success(
        `${res.imported} PO importé(s) · ${res.rapproches} rapproché(s) · ${res.ambigus} ambigu(s) · ${res.erreurs} erreur(s)`,
      );
      if (res.messages.length) toast.info(res.messages.join(" · "));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Synchronisation impossible");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      {/* ===== En-tête ===== */}
      <div className="dvx-head">
        <div className="min-w-0">
          <h1 className="dvx-title">Bons de commande</h1>
          <p className="dvx-sub">
            Import automatique depuis Gmail (libellé « Devis CAT FRANCE et PO K2 ») et rapprochement par VIN.
          </p>
        </div>
        <button type="button" onClick={sync} disabled={syncing} className="dvx-cta">
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Synchronisation…" : "Synchroniser Gmail"}
        </button>
      </div>

      {/* ===== Statistiques ===== */}
      <div className="dvx-stats">
        {TABS.map((t) => (
          <div className="dvx-stat" key={t.key}>
            <span className={`dvx-stat-ic ${t.tone === "red" ? "orange" : t.tone === "violet" ? "violet" : t.tone === "green" ? "green" : "blue"}`}>
              <t.icon size={17} />
            </span>
            <p className="dvx-stat-k">{t.label}</p>
            <p className="dvx-stat-v">{counts[t.key]}</p>
          </div>
        ))}
      </div>

      {/* ===== Onglets ===== */}
      <div className="dvx-filters">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`dvx-btn ${active ? "solid" : "outline"}`}
            >
              <Icon size={14} /> {t.label}
              <span className="dvx-badge grey">{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LogoLoader label="Chargement des bons de commande…" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={FileWarning} title="Aucun bon de commande" description="Aucun bon de commande dans cette catégorie." />
      ) : (
        <div className="space-y-3.5">
          {visible.map((po) => (
            <PoCard key={po.id} po={po} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function PoCard({ po, onChanged }: { po: PoRow; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [vinDraft, setVinDraft] = useState(po.vin ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DevisSearchRow[]>([]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  const openPdf = async () => {
    if (!po.pdf_path) return;
    const url = await getPoPdfUrl({ data: { path: po.pdf_path } });
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("PDF indisponible");
  };

  const search = async () => {
    try {
      setResults((await searchDevisForPo({ data: { query } })) as DevisSearchRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recherche impossible");
    }
  };

  const statutTone = po.statut === "rapproche" ? "green" : po.statut === "erreur_extraction" ? "red" : po.statut === "ambigu" ? "violet" : "orange";

  return (
    <div className="dvx-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="dvx-ref">PO {po.numero_po}</span>
            <span className={`dvx-badge ${statutTone}`}>
              {po.statut === "rapproche" ? "Rapproché" : po.statut === "erreur_extraction" ? "Erreur d'extraction" : po.statut === "ambigu" ? "À valider" : "En attente"}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] text-[#70727d]">
            {po.vin ? <span className="dvx-vin">VIN {po.vin}</span> : "VIN non extrait"}
            {po.montant_ht != null && ` · ${po.montant_ht.toFixed(2)} € HT`}
            {po.date_livraison && ` · Livraison ${new Date(po.date_livraison).toLocaleDateString("fr-FR")}`}
          </p>
          {po.designation && <p className="text-[12.5px] text-[#14161c] mt-1">{po.designation}</p>}
          {po.adresse_livraison && (
            <p className="text-[11.5px] text-[#70727d] mt-0.5">Livraison&nbsp;: {po.adresse_livraison}</p>
          )}
          {po.destinataire && <p className="text-[10.5px] text-[#a3a4ac] mt-0.5">Fournisseur&nbsp;: {po.destinataire}</p>}
          {po.email_subject && <p className="text-[10.5px] text-[#a3a4ac] mt-1">✉ {po.email_subject}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          {po.pdf_path && (
            <button type="button" onClick={openPdf} className="dvx-ico" title="Ouvrir le PDF">
              <ExternalLink size={15} />
            </button>
          )}
          {po.statut !== "rapproche" && po.vin && (
            <button type="button" disabled={busy} onClick={() => run(() => retryPoMatch({ data: { poId: po.id } }), "Rapprochement relancé")} className="dvx-btn outline">
              <RefreshCw size={12} /> Relancer
            </button>
          )}
          {po.statut === "rapproche" && (
            <button type="button" disabled={busy} onClick={() => run(() => unlinkPo({ data: { poId: po.id } }), "PO détaché")} className="dvx-ico danger" title="Détacher">
              <Unlink size={15} />
            </button>
          )}
        </div>
      </div>

      {po.statut === "rapproche" && po.devis && (
        <div className="dvx-group">
          <p className="text-[12.5px] text-[#14161c]">
            Devis <strong className="dvx-ref">{po.devis.numero}</strong> — {po.devis.prenom} {po.devis.nom} · {po.devis.depart} → {po.devis.arrivee} · {Number(po.devis.prix_estime).toFixed(2)} €
          </p>
        </div>
      )}

      {po.statut === "erreur_extraction" && (
        <div className="dvx-group">
          <p className="text-[11.5px] text-[#b45309] mb-2">{po.extraction_error ?? "Champ obligatoire manquant"} — saisir le VIN manuellement :</p>
          <div className="flex gap-2">
            <input
              value={vinDraft}
              onChange={(e) => setVinDraft(normalizeVin(e.target.value))}
              maxLength={17}
              placeholder="VIN (17 caractères)"
              className="dvx-input flex-1 uppercase tracking-widest"
            />
            <button type="button" disabled={busy || vinDraft.length !== 17} onClick={() => run(() => setPoVin({ data: { poId: po.id, vin: vinDraft } }), "VIN enregistré")} className="dvx-btn solid">
              Valider
            </button>
          </div>
        </div>
      )}

      {po.statut === "ambigu" && po.candidats?.length > 0 && (
        <div className="dvx-group">
          <p className="dvx-group-t">Plusieurs devis correspondent à ce VIN</p>
          <div className="grid gap-2 md:grid-cols-2">
            {po.candidats.map((c) => (
              <div key={c.id} className="dvx-veh space-y-1">
                <p className="dvx-ref">{c.numero}</p>
                <p className="text-[11.5px] text-[#70727d]">
                  {c.client} · {c.arrivee ?? "—"} · {c.prix_estime != null ? `${Number(c.prix_estime).toFixed(2)} €` : "—"}
                </p>
                <p className="text-[10.5px] text-[#a3a4ac]">{new Date(c.created_at).toLocaleString("fr-FR")}</p>
                <button type="button" disabled={busy} onClick={() => run(() => linkPoToDevis({ data: { poId: po.id, devisId: c.id } }), "PO rapproché")} className="dvx-btn solid mt-1">
                  <Link2 size={12} /> Rattacher ce devis
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(po.statut === "non_rapproche" || po.statut === "ambigu") && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-[11.5px] text-[#70727d]">Rapprochement manuel — chercher un devis</summary>
          <div className="mt-2 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="VIN, n° de devis ou nom client"
              className="dvx-input flex-1"
            />
            <button type="button" onClick={search} className="dvx-btn outline">Rechercher</button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {results.map((d) => (
              <li key={d.id} className="dvx-veh flex items-center justify-between gap-2 text-[11.5px]">
                <span>
                  <strong className="dvx-ref">{d.numero}</strong> · {d.prenom} {d.nom} · {d.depart} → {d.arrivee} · {Number(d.prix_estime).toFixed(2)} € · {d.statut}
                </span>
                <button type="button" disabled={busy} onClick={() => run(() => linkPoToDevis({ data: { poId: po.id, devisId: d.id } }), "PO rapproché")} className="dvx-btn solid">
                  Rattacher
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
