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

const TABS: { key: TabKey; label: string; icon: typeof CheckCircle2 }[] = [
  { key: "rapproche", label: "Rapprochés", icon: CheckCircle2 },
  { key: "non_rapproche", label: "En attente", icon: Clock },
  { key: "ambigu", label: "À valider manuellement", icon: AlertTriangle },
  { key: "erreur_extraction", label: "Erreurs d'extraction", icon: FileWarning },
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
    <div className="p-4 md:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Bons de commande</h1>
          <p className="text-sm text-muted-foreground">
            Import automatique depuis Gmail (libellé « Devis CAT FRANCE et PO K2 ») et rapprochement par VIN.
          </p>
        </div>
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2F5FFF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Synchronisation…" : "Synchroniser Gmail"}
        </button>
      </header>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                active ? "border-[#2F5FFF] bg-[#2F5FFF]/10 text-[#2F5FFF] font-semibold" : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Icon size={14} /> {t.label}
              <span className="tabular-nums rounded-full bg-muted px-1.5 text-[11px]">{counts[t.key]}</span>
            </button>
          );
        })}
      </nav>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun bon de commande dans cette catégorie.
        </p>
      ) : (
        <div className="space-y-3">
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

  return (
    <article className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-lg tabular-nums">PO {po.numero_po}</p>
          <p className="text-xs text-muted-foreground">
            {po.vin ? `VIN ${po.vin}` : "VIN non extrait"}
            {po.montant_ht != null && ` · ${po.montant_ht.toFixed(2)} € HT`}
            {po.date_livraison && ` · Livraison ${new Date(po.date_livraison).toLocaleDateString("fr-FR")}`}
          </p>
          {po.destinataire && <p className="text-xs text-muted-foreground mt-0.5">{po.destinataire}</p>}
          {po.email_subject && <p className="text-[11px] text-muted-foreground/70 mt-1">✉ {po.email_subject}</p>}
        </div>
        <div className="flex gap-2">
          {po.pdf_path && (
            <button type="button" onClick={openPdf} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 inline-flex items-center gap-1">
              <ExternalLink size={12} /> PDF
            </button>
          )}
          {po.statut !== "rapproche" && po.vin && (
            <button type="button" disabled={busy} onClick={() => run(() => retryPoMatch({ data: { poId: po.id } }), "Rapprochement relancé")} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 inline-flex items-center gap-1">
              <RefreshCw size={12} /> Relancer
            </button>
          )}
          {po.statut === "rapproche" && (
            <button type="button" disabled={busy} onClick={() => run(() => unlinkPo({ data: { poId: po.id } }), "PO détaché")} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 inline-flex items-center gap-1">
              <Unlink size={12} /> Détacher
            </button>
          )}
        </div>
      </div>

      {po.statut === "rapproche" && po.devis && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-sm">
          Devis <strong>{po.devis.numero}</strong> — {po.devis.prenom} {po.devis.nom} · {po.devis.depart} → {po.devis.arrivee} · {Number(po.devis.prix_estime).toFixed(2)} €
        </div>
      )}

      {po.statut === "erreur_extraction" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs text-amber-600">{po.extraction_error ?? "Champ obligatoire manquant"} — saisir le VIN manuellement :</p>
          <div className="flex gap-2">
            <input
              value={vinDraft}
              onChange={(e) => setVinDraft(normalizeVin(e.target.value))}
              maxLength={17}
              placeholder="VIN (17 caractères)"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm uppercase tracking-widest"
            />
            <button type="button" disabled={busy || vinDraft.length !== 17} onClick={() => run(() => setPoVin({ data: { poId: po.id, vin: vinDraft } }), "VIN enregistré")} className="text-xs px-3 py-1.5 rounded-lg bg-[#2F5FFF] text-white disabled:opacity-50">
              Valider
            </button>
          </div>
        </div>
      )}

      {po.statut === "ambigu" && po.candidats?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-amber-500">Plusieurs devis correspondent à ce VIN</p>
          <div className="grid gap-2 md:grid-cols-2">
            {po.candidats.map((c) => (
              <div key={c.id} className="rounded-xl border border-border p-3 text-sm space-y-1">
                <p className="font-semibold">{c.numero}</p>
                <p className="text-xs text-muted-foreground">
                  {c.client} · {c.arrivee ?? "—"} · {c.prix_estime != null ? `${Number(c.prix_estime).toFixed(2)} €` : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground/70">{new Date(c.created_at).toLocaleString("fr-FR")}</p>
                <button type="button" disabled={busy} onClick={() => run(() => linkPoToDevis({ data: { poId: po.id, devisId: c.id } }), "PO rapproché")} className="mt-1 text-xs px-3 py-1.5 rounded-lg bg-[#2F5FFF] text-white inline-flex items-center gap-1">
                  <Link2 size={12} /> Rattacher ce devis
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(po.statut === "non_rapproche" || po.statut === "ambigu") && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">Rapprochement manuel — chercher un devis</summary>
          <div className="mt-2 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="VIN, n° de devis ou nom client"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
            <button type="button" onClick={search} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50">Rechercher</button>
          </div>
          <ul className="mt-2 space-y-1">
            {results.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                <span>
                  <strong>{d.numero}</strong> · {d.prenom} {d.nom} · {d.depart} → {d.arrivee} · {Number(d.prix_estime).toFixed(2)} € · {d.statut}
                </span>
                <button type="button" disabled={busy} onClick={() => run(() => linkPoToDevis({ data: { poId: po.id, devisId: d.id } }), "PO rapproché")} className="px-2 py-1 rounded bg-[#2F5FFF] text-white">
                  Rattacher
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
