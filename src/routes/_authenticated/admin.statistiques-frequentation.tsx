/**
 * Admin · Statistiques › Fréquentation du site (visites anonymes, fonction admin_site_stats).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { AreaChart, Funnel, HBars, Kpi, Trend, fr } from "@/components/admin/stats/StatsCharts";
import { supabase } from "@/integrations/supabase/client";
import "@/components/admin/stats/admin-stats.css";

export const Route = createFileRoute("/_authenticated/admin/statistiques-frequentation")({
  head: () => ({ meta: [{ title: "Fréquentation du site | Transports Ligneo" }] }),
  component: Frequentation,
});

const rpc = supabase as unknown as { rpc: (f: string, a: object) => Promise<{ data: any; error: { message: string } | null }> };

type Stats = {
  days: number; live: number; visitors: number; visitors_prev: number; pageviews: number;
  per_day: { day: string; visitors: number }[];
  pages: { label: string; n: number }[]; sources: { label: string; n: number }[];
  devices: { label: string; n: number }[]; cities: { label: string; n: number }[];
  funnel: { visitors: number; saw_price: number; requested: number; signed: number };
};

const PAGE_NAMES: Record<string, string> = {
  "/": "Accueil", "/tarifs": "Tarifs et estimateur", "/services": "Nos services", "/professionnels": "Professionnels",
  "/remarketing": "Remarketing", "/suivi": "Suivi de véhicule", "/contact": "Contact", "/a-propos": "À propos",
};

function Frequentation() {
  const [days, setDays] = useState(30);
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    const { data, error } = await rpc.rpc("admin_site_stats", { p_days: d });
    if (error) { setErr(error.message); return; }
    setErr(null); setS(data as Stats);
  }, []);

  useEffect(() => {
    void load(days);
    const iv = window.setInterval(() => void load(days), 60_000);
    return () => window.clearInterval(iv);
  }, [days, load]);

  const devTotal = (s?.devices ?? []).reduce((a, b) => a + b.n, 0) || 1;

  return (
    <div className="ast">
      <AdminSectionHeader breadcrumb="Statistiques" eyebrow="Fréquentation du site" title="Fréquentation" highlight="du site"
        subtitle="Visites anonymes du site public, sans cookie de pistage. L'admin, les espaces clients et l'appli Driver ne sont pas comptés." />

      <div className="ast-range" role="tablist" aria-label="Période">
        {[[7, "7 jours"], [30, "30 jours"], [90, "3 mois"]].map(([d, l]) => (
          <button key={d} type="button" role="tab" aria-selected={days === d} className={days === d ? "on" : ""} onClick={() => setDays(d as number)}>{l}</button>
        ))}
      </div>

      {err && <p className="ast-note">Statistiques indisponibles : {/function|does not exist|schema cache/i.test(err) ? "lance le fichier SQL statistiques_site dans Supabase." : err}</p>}
      {!s && !err && <div className="ast-loadbar"><i /></div>}

      {s && (<>
        <div className="ast-kpis">
          <Kpi live label="En direct" value={fr(s.live)} sub="actifs ces 5 dernières minutes" />
          <Kpi label="Visiteurs" value={fr(s.visitors)} sub={<Trend now={s.visitors} before={s.visitors_prev} />} />
          <Kpi label="Pages vues" value={fr(s.pageviews)} sub={`${s.visitors ? fr(s.pageviews / s.visitors, 1) : "0"} pages par visite`} />
          <Kpi label="Demandes de devis" value={fr(s.funnel.requested)} sub={`${s.visitors ? fr((s.funnel.requested / s.visitors) * 100, 1) : "0"} % des visiteurs`} />
        </div>

        <section className="ast-card">
          <div className="ast-card-hd"><div><h2>Visiteurs par jour</h2><p>{days === 7 ? "7 derniers jours" : days === 30 ? "30 derniers jours" : "3 derniers mois"}</p></div></div>
          <AreaChart label="Visiteurs par jour" data={s.per_day.map((d) => ({ day: d.day, value: d.visitors }))} />
        </section>

        <div className="ast-grid2">
          <section className="ast-card"><div className="ast-card-hd"><div><h2>Pages les plus vues</h2></div></div>
            <HBars rows={s.pages.map((p) => ({ label: PAGE_NAMES[p.label] ?? p.label, n: p.n }))} /></section>
          <section className="ast-card"><div className="ast-card-hd"><div><h2>D'où viennent les visiteurs</h2></div></div>
            <HBars rows={s.sources} />
            {s.devices.length > 0 && (
              <div className="ast-kpis" style={{ marginTop: 14, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
                {s.devices.slice(0, 2).map((d) => <Kpi key={d.label} label={d.label} value={`${Math.round((d.n / devTotal) * 100)} %`} />)}
              </div>
            )}
          </section>
        </div>

        <div className="ast-grid2">
          <section className="ast-card"><div className="ast-card-hd"><div><h2>Du visiteur au devis signé</h2><p>Sur la période choisie</p></div></div>
            <Funnel steps={[
              { label: "Visiteurs", n: s.funnel.visitors },
              { label: "Ont vu un prix", n: s.funnel.saw_price },
              { label: "Ont demandé un devis", n: s.funnel.requested },
              { label: "Devis signés", n: s.funnel.signed },
            ]} /></section>
          <section className="ast-card"><div className="ast-card-hd"><div><h2>Villes des visiteurs</h2><p>Ville approximative du réseau internet</p></div></div>
            <HBars rows={s.cities} /></section>
        </div>
      </>)}
    </div>
  );
}
