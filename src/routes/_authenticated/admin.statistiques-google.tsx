/**
 * Admin · Statistiques › Recherches Google (Google Search Console, via getSearchConsoleStats).
 * Tant que la connexion n'est pas faite, la page explique les étapes.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { HBars, Kpi, fr } from "@/components/admin/stats/StatsCharts";
import { getSearchConsoleStats } from "@/lib/site-analytics.functions";
import "@/components/admin/stats/admin-stats.css";

export const Route = createFileRoute("/_authenticated/admin/statistiques-google")({
  head: () => ({ meta: [{ title: "Recherches Google | Transports Ligneo" }] }),
  component: RecherchesGoogle,
});

type Res = Awaited<ReturnType<typeof getSearchConsoleStats>>;
const pos = (p: number) => fr(p, 1);
const dateFr = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

function RecherchesGoogle() {
  const [days, setDays] = useState(28);
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fetchStats = useServerFn(getSearchConsoleStats);

  useEffect(() => {
    let alive = true;
    setRes(null); setErr(null);
    fetchStats({ data: { days } })
      .then((r) => { if (alive) setRes(r); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : "Erreur inconnue"); });
    return () => { alive = false; };
  }, [days, fetchStats]);

  return (
    <div className="ast">
      <AdminSectionHeader breadcrumb="Statistiques" eyebrow="Recherches Google" title="Recherches" highlight="Google"
        subtitle="Ce que les gens tapent sur Google quand ton site apparaît, combien cliquent, et ta position. Objectif : le top 5." />

      <div className="ast-range" role="tablist" aria-label="Période">
        {[[7, "7 jours"], [28, "28 jours"], [90, "3 mois"]].map(([d, l]) => (
          <button key={d} type="button" role="tab" aria-selected={days === d} className={days === d ? "on" : ""} onClick={() => setDays(d as number)}>{l}</button>
        ))}
      </div>

      {!res && !err && <div className="ast-loadbar"><i /></div>}
      {err && <p className="ast-note">Google n'a pas répondu : {err}</p>}

      {res && !res.configured && (
        <section className="ast-card">
          <div className="ast-card-hd"><div><h2>Relier Google Search Console</h2><p>À faire une seule fois, environ 15 minutes</p></div></div>
          <ol className="ast-steps">
            <li>Sur <b>search.google.com/search-console</b>, ajoute la propriété <b>Domaine</b> <code>transportsligneo.fr</code>. Google donne un enregistrement TXT : ajoute-le dans la zone DNS de ton domaine chez IONOS, puis clique sur Valider.</li>
            <li>Sur <b>console.cloud.google.com</b>, crée un projet, active l'API <b>Google Search Console API</b>, puis crée un <b>compte de service</b> et télécharge sa clé au format JSON.</li>
            <li>Dans Search Console › Paramètres › Utilisateurs, ajoute l'adresse e-mail du compte de service avec l'accès <b>Restreint</b>.</li>
            <li>Sur Vercel › ton projet › Settings › Environment Variables, ajoute <code>GSC_CLIENT_EMAIL</code> (l'e-mail du compte de service), <code>GSC_PRIVATE_KEY</code> (la valeur private_key du fichier JSON) et <code>GSC_SITE_URL</code> = <code>sc-domain:transportsligneo.fr</code>, puis redéploie.</li>
          </ol>
          <p className="ast-empty">Google garde 16 mois d'historique : dès que c'est relié, les chiffres des derniers mois apparaissent ici.</p>
        </section>
      )}

      {res && res.configured && (<>
        <div className="ast-ok"><b>Google Search Console relié</b><span>· du {dateFr(res.start)} au {dateFr(res.end)} (Google a 2 jours de retard)</span></div>
        <div className="ast-kpis">
          <Kpi label="Clics depuis Google" value={fr(res.totals.clicks)} sub={res.prev.clicks ? <><span className={res.totals.clicks >= res.prev.clicks ? "ast-up" : "ast-down"}>{res.totals.clicks >= res.prev.clicks ? "+" : ""}{Math.round(((res.totals.clicks - res.prev.clicks) / res.prev.clicks) * 100)} %</span> vs période d'avant</> : "Première période mesurée"} />
          <Kpi label="Affichages" value={fr(res.totals.impressions)} sub="fois où le site est apparu" />
          <Kpi label="Taux de clic" value={`${fr(res.totals.ctr * 100, 1)} %`} sub="clics ÷ affichages" />
          <Kpi label="Position moyenne" value={pos(res.totals.position)} sub={res.prev.position ? <span className={res.totals.position <= res.prev.position ? "ast-up" : "ast-down"}>{res.totals.position <= res.prev.position ? "▲" : "▼"} {pos(Math.abs(res.prev.position - res.totals.position))} place(s)</span> : undefined} />
        </div>

        <section className="ast-card">
          <div className="ast-card-hd"><div><h2>Les recherches qui t'amènent</h2><p>Classées par clics</p></div></div>
          {res.queries.length === 0 ? <p className="ast-empty">Pas encore de recherches sur cette période.</p> : (
            <div className="ast-tbl"><table>
              <thead><tr><th>Recherche Google</th><th className="n">Clics</th><th className="n">Affichages</th><th className="n">Position</th><th className="n">Évolution</th></tr></thead>
              <tbody>{res.queries.map((q) => {
                const delta = q.prevPosition != null ? q.prevPosition - q.position : null;
                return (
                  <tr key={q.query}>
                    <td>{q.query}</td>
                    <td className="n">{fr(q.clicks)}</td>
                    <td className="n">{fr(q.impressions)}</td>
                    <td className="n">{pos(q.position)} {q.position <= 5 && <span className="ast-chip ok">Top 5</span>}</td>
                    <td className={`n ${delta == null ? "" : delta >= 0 ? "ast-up" : "ast-down"}`}>{delta == null ? "Nouveau" : `${delta >= 0 ? "▲" : "▼"} ${pos(Math.abs(delta))}`}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </section>

        <section className="ast-card">
          <div className="ast-card-hd"><div><h2>Pages qui reçoivent les clics</h2></div></div>
          <HBars rows={res.pages.map((p) => ({ label: p.page, n: p.clicks }))} />
        </section>
      </>)}
    </div>
  );
}
