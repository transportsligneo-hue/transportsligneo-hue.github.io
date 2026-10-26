/**
 * Admin · Statistiques › Estimateur : chaque prix affiché sur le site, en direct
 * (table estimations_log, fonction admin_estimation_stats).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { Columns, Kpi, Trend, fr } from "@/components/admin/stats/StatsCharts";
import { supabase } from "@/integrations/supabase/client";
import "@/components/admin/stats/admin-stats.css";

export const Route = createFileRoute("/_authenticated/admin/statistiques-estimateur")({
  head: () => ({ meta: [{ title: "Estimateur | Transports Ligneo" }] }),
  component: Estimateur,
});

const rpc = supabase as unknown as { rpc: (f: string, a: object) => Promise<{ data: any; error: { message: string } | null }> };

type Recent = { id: string; created_at: string; depart_ville: string | null; depart_dept: string | null; arrivee_ville: string | null; arrivee_dept: string | null; km: number | null; vehicule: string | null; prix: number | null; demande_envoyee: boolean };
type Stats = {
  days: number; total: number; total_prev: number; requested: number; avg_price: number | null; avg_km: number | null;
  trips: { label: string; n: number; req: number }[]; bands: { label: string; n: number; req: number }[]; recent: Recent[];
};

const place = (v: string | null, d: string | null) => `${v ?? "Ville inconnue"}${d ? ` (${d})` : ""}`;

function Estimateur() {
  const [days, setDays] = useState(30);
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const known = useRef<Set<string>>(new Set());

  const load = useCallback(async (d: number) => {
    const { data, error } = await rpc.rpc("admin_estimation_stats", { p_days: d });
    if (error) { setErr(error.message); return; }
    const st = data as Stats;
    const first = st.recent[0];
    if (first && known.current.size > 0 && !known.current.has(first.id)) setFresh(first.id);
    st.recent.forEach((r) => known.current.add(r.id));
    setErr(null); setS(st);
  }, []);

  useEffect(() => {
    void load(days);
    const ch = supabase.channel("admin-estimations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "estimations_log" }, () => void load(days))
      .subscribe();
    const iv = window.setInterval(() => void load(days), 60_000);
    return () => { void supabase.removeChannel(ch); window.clearInterval(iv); };
  }, [days, load]);

  return (
    <div className="ast">
      <AdminSectionHeader breadcrumb="Statistiques" eyebrow="Estimateur" title="Estimations" highlight="faites sur le site"
        subtitle="Chaque prix calculé, même quand la personne repart sans demander de devis. Seules la ville et le département sont gardés." />

      <div className="ast-range" role="tablist" aria-label="Période">
        {[[7, "7 jours"], [30, "30 jours"], [90, "3 mois"]].map(([d, l]) => (
          <button key={d} type="button" role="tab" aria-selected={days === d} className={days === d ? "on" : ""} onClick={() => setDays(d as number)}>{l}</button>
        ))}
      </div>

      {err && <p className="ast-note">Statistiques indisponibles : {/function|does not exist|schema cache/i.test(err) ? "lance le fichier SQL statistiques_site dans Supabase." : err}</p>}
      {!s && !err && <div className="ast-loadbar"><i /></div>}

      {s && (<>
        <div className="ast-kpis">
          <Kpi label="Estimations" value={fr(s.total)} sub={<Trend now={s.total} before={s.total_prev} />} />
          <Kpi label="Devenues demandes" value={fr(s.requested)} sub={`${s.total ? fr((s.requested / s.total) * 100, 1) : "0"} % des estimations`} />
          <Kpi label="Prix moyen affiché" value={s.avg_price != null ? `${fr(s.avg_price)} €` : "·"} sub="TTC" />
          <Kpi label="Distance moyenne" value={s.avg_km != null ? `${fr(s.avg_km)} km` : "·"} sub="par trajet" />
        </div>

        <section className="ast-card">
          <div className="ast-card-hd"><div><h2><i className="ast-live" style={{ marginRight: 8, verticalAlign: "middle" }} />En direct</h2><p>Les 15 dernières estimations</p></div></div>
          {s.recent.length === 0 && <p className="ast-empty">Aucune estimation pour le moment. Elles apparaîtront ici dès qu'un visiteur calcule un prix.</p>}
          <div className="ast-feed">
            {s.recent.map((r) => (
              <div key={r.id} className={`ast-fd${fresh === r.id ? " is-new" : ""}`}>
                <time>{new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time>
                <b>{place(r.depart_ville, r.depart_dept)} → {place(r.arrivee_ville, r.arrivee_dept)}</b>
                <span className="p">{r.prix != null ? `${fr(Number(r.prix))} €` : "·"}</span>
                <small>
                  {r.km != null && <span>{fr(Number(r.km))} km</span>}
                  {r.vehicule && <span>· {r.vehicule}</span>}
                  {new Date(r.created_at).toDateString() !== new Date().toDateString() && <span>· {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
                  {r.demande_envoyee ? <span className="ast-chip ok">Demande envoyée</span> : <span className="ast-chip no">Pas de demande</span>}
                </small>
              </div>
            ))}
          </div>
        </section>

        <div className="ast-grid2">
          <section className="ast-card"><div className="ast-card-hd"><div><h2>Trajets les plus estimés</h2><p>et combien ont demandé un devis</p></div></div>
            {s.trips.length === 0 ? <p className="ast-empty">Pas encore de données.</p> : (
              <div className="ast-tbl"><table>
                <thead><tr><th>Trajet</th><th className="n">Estim.</th><th className="n">Devis</th><th className="n">Taux</th></tr></thead>
                <tbody>{s.trips.map((t) => (<tr key={t.label}><td>{t.label}</td><td className="n">{t.n}</td><td className="n">{t.req}</td><td className="n">{t.n ? Math.round((t.req / t.n) * 100) : 0} %</td></tr>))}</tbody>
              </table></div>
            )}
          </section>
          <section className="ast-card"><div className="ast-card-hd"><div><h2>Taux de demande selon le prix</h2><p>Part des estimations suivies d'une demande de devis</p></div></div>
            {s.total === 0 ? <p className="ast-empty">Pas encore de données.</p> : (
              <Columns label="Taux de demande selon le prix" rows={s.bands.map((b, i) => ({
                label: b.label, value: b.n ? Math.round((b.req / b.n) * 100) : 0, dim: i >= 4,
                title: `${b.label} : ${b.req} demande(s) sur ${b.n} estimation(s)`,
              }))} />
            )}
          </section>
        </div>
      </>)}
    </div>
  );
}
