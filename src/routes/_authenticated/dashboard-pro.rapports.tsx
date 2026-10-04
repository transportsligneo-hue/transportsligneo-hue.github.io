import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  STATUS_META, deliveredOnTime, downloadCsv, euro, isCancelled, isDone, useProMissions,
} from "@/hooks/useProMissions";

export const Route = createFileRoute("/_authenticated/dashboard-pro/rapports")({
  head: () => ({
    meta: [
      { title: "Rapports & statistiques — Espace Pro Ligneo" },
      { name: "description", content: "Coûts, délais et récapitulatif mensuel de vos convoyages, exportables." },
    ],
  }),
  component: RapportsPage,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);

function RapportsPage() {
  const { missions, loading } = useProMissions();
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth() - 5, 1)));
  const [to, setTo] = useState(iso(now));

  const scoped = useMemo(
    () => missions.filter((m) => !isCancelled(m.statut) && m.date_prise_en_charge >= from && m.date_prise_en_charge <= to),
    [missions, from, to],
  );

  const stats = useMemo(() => {
    const total = scoped.reduce((s, m) => s + Number(m.prix_total ?? 0), 0);
    const done = scoped.filter((m) => isDone(m.statut));
    const onTime = done.filter((m) => deliveredOnTime(m)).length;
    const delays = done.map((m) => (new Date(m.updated_at).getTime() - new Date(m.date_prise_en_charge).getTime()) / 86400000);
    const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;
    const routes = new Map<string, { n: number; sum: number }>();
    for (const m of scoped) {
      const k = `${m.ville_depart} → ${m.ville_arrivee}`;
      const r = routes.get(k) ?? { n: 0, sum: 0 };
      r.n++; r.sum += Number(m.prix_total ?? 0);
      routes.set(k, r);
    }
    const months = new Map<string, { n: number; sum: number }>();
    for (const m of scoped) {
      const k = m.date_prise_en_charge.slice(0, 7);
      const r = months.get(k) ?? { n: 0, sum: 0 };
      r.n++; r.sum += Number(m.prix_total ?? 0);
      months.set(k, r);
    }
    return {
      count: scoped.length,
      total,
      avg: scoped.length ? total / scoped.length : 0,
      punctuality: done.length ? Math.round((onTime / done.length) * 100) : null,
      avgDelay,
      topRoutes: [...routes.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8),
      months: [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])),
    };
  }, [scoped]);

  const exportCsv = () =>
    downloadCsv(`ligneo-convoyages-${from}-${to}.csv`, [
      ["Numéro", "Date", "Départ", "Arrivée", "Immatriculation", "Véhicule", "Statut", "Montant HT (€)"],
      ...scoped.map((m) => [
        m.numero, m.date_prise_en_charge, m.ville_depart, m.ville_arrivee, m.immatriculation ?? "",
        [m.marque, m.modele].filter(Boolean).join(" "), STATUS_META[m.statut]?.label ?? m.statut,
        Number(m.prix_total ?? 0).toFixed(2).replace(".", ","),
      ]),
    ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-pro-accent font-semibold">Analyse</p>
          <h1 className="text-2xl font-semibold text-foreground">Rapports & statistiques</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="pp-field">Du<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="pp-field">Au<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="pp-quick pp-quick-primary" onClick={exportCsv} disabled={!scoped.length}>
            <Download size={14} /> Export comptable (CSV / Excel)
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="pp-kpi"><span className="pp-kpi-val">{stats.count}</span><span className="pp-kpi-lbl">Missions</span></div>
            <div className="pp-kpi"><span className="pp-kpi-val">{euro(stats.total)}</span><span className="pp-kpi-lbl">Montant total</span></div>
            <div className="pp-kpi"><span className="pp-kpi-val">{euro(stats.avg)}</span><span className="pp-kpi-lbl">Coût moyen / mission</span></div>
            <div className="pp-kpi">
              <span className="pp-kpi-val">{stats.punctuality === null ? "—" : `${stats.punctuality} %`}</span>
              <span className="pp-kpi-lbl">
                Délais respectés{stats.avgDelay !== null ? ` · ${stats.avgDelay.toFixed(1)} j en moyenne` : ""}
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="pp-panel">
              <h3>Récapitulatif mensuel</h3>
              <table className="pp-table">
                <thead><tr><th>Mois</th><th>Missions</th><th>Total</th><th>Moyenne</th></tr></thead>
                <tbody>
                  {stats.months.map(([k, v]) => (
                    <tr key={k}>
                      <td className="capitalize">{new Date(k + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</td>
                      <td>{v.n}</td><td>{euro(v.sum)}</td><td>{euro(v.sum / v.n)}</td>
                    </tr>
                  ))}
                  {!stats.months.length && <tr><td colSpan={4} className="pp-empty">Aucune mission sur la période.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="pp-panel">
              <h3>Trajets les plus fréquents</h3>
              <table className="pp-table">
                <thead><tr><th>Trajet</th><th>Missions</th><th>Coût moyen</th></tr></thead>
                <tbody>
                  {stats.topRoutes.map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td>{v.n}</td><td>{euro(v.sum / v.n)}</td></tr>
                  ))}
                  {!stats.topRoutes.length && <tr><td colSpan={3} className="pp-empty">Aucun trajet sur la période.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
