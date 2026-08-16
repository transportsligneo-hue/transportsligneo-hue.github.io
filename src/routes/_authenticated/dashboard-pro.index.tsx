import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import FleetPageHeader from "@/components/flotte/FleetPageHeader";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import {
  Truck, Clock, CheckCircle, PlusCircle, Loader2, ArrowUpRight, FileText,
  Receipt, Car, Wrench, Users, Activity, MoreHorizontal, TrendingUp,
} from "lucide-react";
import { ActiveMissionsMap } from "@/components/map/ActiveMissionsMap";
import { legRef } from "@/lib/mission-number";


export const Route = createFileRoute("/_authenticated/dashboard-pro/")({
  component: ProDashboard,
});

interface MissionRow {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  statut: string;
  prix_total: number;
  created_at: string;
  leg_type?: string | null;
  leg_index?: number | null;
}
interface VehicleRow {
  id: string; marque: string | null; modele: string | null;
  immatriculation: string | null; statut: string;
}
interface DevisRow {
  id: string; numero: string; depart: string; arrivee: string;
  prix_estime: number | null; statut: string; created_at: string;
  paid_at: string | null; accepted_at: string | null; locked_at: string | null; mission_id: string | null;
}
interface FactureRow {
  id: string; numero: string; prix_ttc: number | null;
  statut: string; mode_paiement: string | null;
  date_facture: string | null; created_at: string;
}
interface ActivityRow {
  id: string; action: string; entity_type: string;
  actor_label: string | null; created_at: string;
}

const V3_STATUS: Record<string, { cls: string; label: string }> = {
  en_attente: { cls: "wait", label: "En attente" },
  confirmee:  { cls: "progress", label: "Confirmée" },
  en_cours:   { cls: "progress", label: "En route" },
  livree:     { cls: "done", label: "Livrée" },
  terminee:   { cls: "done", label: "Terminée" },
  annulee:    { cls: "danger", label: "Annulée" },
  refuse:     { cls: "danger", label: "Refusée" },
};

type TabKey = "all" | "cours" | "term" | "attribuer";

function ProDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: orgInfo } = useCurrentOrgAccountType();
  const isFlotte = orgInfo?.accountType === "flotte";

  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [factures, setFactures] = useState<FactureRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const email = user.email ?? "";
      const orFilter = `user_id.eq.${user.id}${email ? `,email.eq.${email}` : ""}`;
      const [{ data: directRows }, { data: profile }, { data: memberships }, { data: devisData }, { data: facturesData }] = await Promise.all([
        supabase.from("missions").select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at, leg_type, leg_index").or(orFilter).order("created_at", { ascending: false }),
        supabase.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("status", "active"),
        supabase.from("devis").select("id, numero, depart, arrivee, prix_estime, statut, created_at, paid_at, accepted_at, locked_at, mission_id").order("created_at", { ascending: false }).limit(6),
        supabase.from("factures").select("id, numero, prix_ttc, statut, mode_paiement, date_facture, created_at").order("created_at", { ascending: false }).limit(6),
      ]);
      const orgIds = Array.from(new Set([profile?.organization_id, ...((memberships ?? []).map(m => m.organization_id))].filter(Boolean))) as string[];
      let orgRows: MissionRow[] = []; let vehicleRows: VehicleRow[] = [];
      if (orgIds.length > 0) {
        const [{ data: mData }, { data: vData }] = await Promise.all([
          supabase.from("missions").select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at, leg_type, leg_index").or(orgIds.map(id => `organization_id.eq.${id},fleet_organization_id.eq.${id}`).join(",")).order("created_at", { ascending: false }),
          supabase.from("vehicles").select("id, marque, modele, immatriculation, statut").in("organization_id", orgIds),
        ]);
        orgRows = (mData ?? []) as MissionRow[];
        vehicleRows = (vData ?? []) as VehicleRow[];
      }
      const { data: aData } = await supabase.from("activity_logs").select("id, action, entity_type, actor_label, created_at").eq("actor_user_id", user.id).order("created_at", { ascending: false }).limit(6);
      const merged = [...((directRows ?? []) as MissionRow[]), ...orgRows];
      const uniqueMissions = Array.from(new Map(merged.map(r => [r.id, r])).values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (cancelled) return;
      setMissions(uniqueMissions);
      setVehicles(vehicleRows);
      setDevis((devisData ?? []) as DevisRow[]);
      setFactures((facturesData ?? []) as FactureRow[]);
      setActivity((aData ?? []) as ActivityRow[]);
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [user]);

  const enCours = missions.filter(m => m.statut === "en_cours" || m.statut === "confirmee").length;
  const terminees = missions.filter(m => m.statut === "livree" || m.statut === "terminee").length;
  const aAttribuer = missions.filter(m => m.statut === "en_attente").length;
  const facturé = useMemo(() => factures.reduce((s, f) => s + Number(f.prix_ttc ?? 0), 0), [factures]);

  const vehicleStats = useMemo(() => {
    const active = vehicles.filter(v => v.statut !== "archive");
    return {
      total: active.length,
      dispo: active.filter(v => v.statut === "actif").length,
      enMission: active.filter(v => v.statut === "en_mission").length,
      indispo: active.filter(v => v.statut === "indispo").length,
    };
  }, [vehicles]);

  const filteredMissions = useMemo(() => {
    if (tab === "cours") return missions.filter(m => m.statut === "en_cours" || m.statut === "confirmee");
    if (tab === "term") return missions.filter(m => m.statut === "livree" || m.statut === "terminee");
    if (tab === "attribuer") return missions.filter(m => m.statut === "en_attente");
    return missions;
  }, [missions, tab]);

  // Bar chart : missions par mois (6 derniers mois)
  const monthlyBars = useMemo(() => {
    const now = new Date();
    const out: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
      const count = missions.filter(m => {
        const md = new Date(m.created_at);
        return md.getFullYear() === d.getFullYear() && md.getMonth() === d.getMonth();
      }).length;
      out.push({ label, count });
    }
    const max = Math.max(1, ...out.map(o => o.count));
    return out.map((o, i) => ({ ...o, pct: Math.max(8, (o.count / max) * 100), isLast: i === out.length - 1 }));
  }, [missions]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-v3-blue" size={28} />
      </div>
    );
  }

  const orgName = orgInfo?.name ?? "";
  const spaceLabel = isFlotte ? "Espace Flotte" : "Espace partenaire";
  const eyebrowLabel = isFlotte ? "Gestion de parc" : "Espace partenaire";
  const heroTitle = isFlotte
    ? <>Parc <span className="electric-text">{orgName || "CAT France"}</span></>
    : <>Bonjour, <span className="electric-text">{orgName || (user?.email?.split("@")[0] ?? "Client")}</span></>;
  const heroSub = isFlotte
    ? "Pilotage global de vos véhicules et de leurs déplacements."
    : "Vos demandes de convoyage et leur suivi en temps réel.";

  return (
    <div className="v3-aurora -mx-4 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-6 lg:-my-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-h-full font-v3-body">
      <div className="mb-8">
        <FleetPageHeader
          breadcrumb="Vue d'ensemble"
          eyebrow={eyebrowLabel}
          title={isFlotte ? "Parc" : "Bonjour,"}
          highlight={orgName || (isFlotte ? "CAT France" : user?.email?.split("@")[0] ?? "Client")}
          subtitle={heroSub}
          badge={isFlotte ? "Flotte partenaire" : null}
          logoUrl={isFlotte ? orgInfo?.logoUrl ?? null : null}
          logoAlt={orgName || "Flotte partenaire"}
          stats={
            isFlotte
              ? [
                  { label: "Véhicules en mission", value: vehicleStats.enMission },
                  { label: "Disponibles", value: vehicleStats.dispo },
                  { label: "Immobilisés", value: vehicleStats.indispo },
                  { label: "Parc total", value: vehicleStats.total, tone: "accent" as const },
                ]
              : undefined
          }
          actions={
            <>
              <Link to="/dashboard-pro/documents" className="flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#70727d] transition-colors hover:border-[#dedee4] hover:text-[#14161c]">
                <FileText size={14} /> Exporter
              </Link>
              {isFlotte ? (
                <Link
                  to="/dashboard-pro/nouvelle-mission"
                  className="flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#70727d] transition-colors hover:border-[#dedee4] hover:text-[#14161c]"
                >
                  <PlusCircle size={14} /> Mission simple
                </Link>
              ) : null}
              <Link
                to={isFlotte ? "/dashboard-pro/nouvelle-mission/groupee" : "/dashboard-pro/nouvelle-mission"}
                className="flex items-center gap-1.5 rounded-[9px] fleet-btn-violet px-4 py-2.5 text-[12.5px] font-semibold transition-colors"
              >
                <PlusCircle size={14} /> {isFlotte ? "Mission groupée" : "Nouvelle mission"}
              </Link>
            </>
          }
        />
      </div>



      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isFlotte ? (
          <>
            <KpiCard tone="blue" trend="flat" trendLabel="stable" label="Véhicules en mission" value={vehicleStats.enMission}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 11l2-5h14l2 5"/><path d="M5 11h14v6H5z"/></svg>} />
            <KpiCard tone="ok" trend="up" trendLabel={`${vehicleStats.dispo}`} label="Disponibles" value={vehicleStats.dispo}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m5 13 4 4L19 7"/></svg>} />
            <KpiCard tone="warn" trend="flat" trendLabel="stable" label="Immobilisés" value={vehicleStats.indispo}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4L21 6l-3-3z"/></svg>} />
            <KpiCard tone="gold" trend="up" trendLabel={`${vehicleStats.total} véh.`} label="Parc total" value={vehicleStats.total}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 21V9l9-6 9 6v12"/></svg>} />
          </>
        ) : (
          <>
            <KpiCard tone="blue" trend="flat" trendLabel="stable" label="Missions en cours" value={enCours}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 11l2-5h14l2 5"/><path d="M5 11h14v6H5z"/></svg>} />
            <KpiCard tone="ok" trend="up" trendLabel={`+${terminees}`} label="Missions terminées" value={terminees}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m5 13 4 4L19 7"/></svg>} />
            <KpiCard tone="gold" trend="up" trendLabel={`+${facturé.toFixed(0)} €`} label="Montant facturé" value={`${facturé.toFixed(0)} €`}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v20M17 7c0-2.2-2.2-4-5-4S7 4.8 7 7s2.2 3.4 5 4 5 1.8 5 4-2.2 4-5 4-5-1.8-5-4"/></svg>} />
            <KpiCard tone="warn" trend="flat" trendLabel="à traiter" label="À attribuer" value={aAttribuer}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>} />
          </>
        )}
      </div>

      {/* Grid: bar chart + CTA */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 mb-8">
        <div className="v3-card v3-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-v3-display text-[15px] font-semibold text-v3">
              {isFlotte ? "Missions groupées par site" : "Missions par mois"}
            </h3>
            <span className="v3-link">6 derniers mois</span>
          </div>
          <div className="v3-bar-chart">
            {monthlyBars.map((b, i) => (
              <div key={b.label} className="v3-bar-col">
                <div
                  className={`v3-bar ${b.isLast ? "gold" : ""}`}
                  style={{ height: `${b.pct}%`, animationDelay: `${i * 0.05 + 0.05}s` }}
                  title={`${b.count} mission${b.count > 1 ? "s" : ""}`}
                />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="v3-cta-gold p-6 flex flex-col justify-center text-center">
          <h3 className="font-v3-display text-[17px] font-semibold text-v3 m-0">
            {isFlotte ? "Programmer un lot de convoyages ?" : "Besoin d'un devis rapide ?"}
          </h3>
          <p className="text-v3-muted text-[13px] mt-1.5 mb-4">
            {isFlotte
              ? "Créez une mission groupée pour plusieurs véhicules de votre parc en quelques minutes."
              : "Créez une demande en moins de 2 minutes, réponse sous 1h ouvrée."}
          </p>
          {isFlotte ? (
            <Link to="/dashboard-pro/nouvelle-mission/groupee" className="v3-btn-gold inline-flex items-center gap-2 self-center">
              <PlusCircle size={14} /> Nouvelle mission groupée
            </Link>
          ) : (
            <Link to="/dashboard-pro/nouvelle-mission" className="v3-btn-gold inline-flex items-center gap-2 self-center">
              <PlusCircle size={14} /> Nouvelle mission
            </Link>
          )}
        </div>

      </div>

      {/* Carte trajets en cours */}
      <div className="mb-8">
        <ActiveMissionsMap
          scope="all"
          title={isFlotte ? "Flotte en mouvement" : "Vos trajets en cours"}
          emptyMessage="Aucune mission en cours pour le moment."
        />
      </div>


      {/* Missions section */}
      <div className="v3-section-head">
        <h2>Mes missions</h2>
        <div className="v3-tabs">
          {([
            ["all", "Toutes"], ["cours", "En cours"], ["term", "Terminées"], ["attribuer", "À attribuer"],
          ] as [TabKey, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`v3-tab ${tab === k ? "active" : ""}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="v3-card overflow-hidden mb-8">
        {/* head */}
        <div className="v3-thead grid items-center gap-4" style={{ gridTemplateColumns: "1.7fr 1.4fr 110px 90px 34px" }}>
          <span>Trajet</span><span className="hidden md:block">Progression</span><span>Statut</span>
          <span className="text-right">Prix</span><span />
        </div>
        {filteredMissions.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="text-v3-dim mx-auto mb-3" size={36} />
            <p className="text-v3-muted text-sm">Aucune mission dans cette vue.</p>
            <Link to="/dashboard-pro/nouvelle-demande" className="inline-flex items-center gap-1.5 mt-4 text-v3-blue text-sm font-semibold hover:underline">
              <PlusCircle size={14} /> Créer une mission
            </Link>
          </div>
        ) : filteredMissions.slice(0, 8).map(m => {
          const st = V3_STATUS[m.statut] ?? { cls: "neutral", label: m.statut };
          const pct = m.statut === "livree" || m.statut === "terminee" ? 100
            : m.statut === "en_cours" ? 55
            : m.statut === "confirmee" ? 30 : 0;
          return (
            <div
              key={m.id}
              onClick={() => navigate({ to: "/dashboard-pro/missions/$missionId", params: { missionId: m.id } })}
              className="v3-trow grid items-center gap-4 cursor-pointer"
              style={{ gridTemplateColumns: "1.7fr 1.4fr 110px 90px 34px" }}
            >
              <div className="min-w-0">
                <div className="v3-mono-id">{legRef(m.numero, m.leg_type, m.leg_index, m.leg_type === "aller" || m.leg_type === "retour")}</div>
                <div className="text-[13.5px] text-v3 font-medium truncate">{m.ville_depart} → {m.ville_arrivee}</div>
              </div>
              <div className="hidden md:block v3-pulse">
                <div className="fill" style={{ width: `${pct}%` }} />
                {pct > 0 && pct < 100 && <div className="dot" />}
              </div>
              <span className={`v3-status ${st.cls}`}>{st.label}</span>
              <div className="v3-price text-right">{Number(m.prix_total).toFixed(0)} €</div>
              <div className="text-v3-dim text-center"><MoreHorizontal size={16} /></div>
            </div>
          );
        })}
        <div className="v3-tfoot">
          <span>Affichage {Math.min(8, filteredMissions.length)} sur {filteredMissions.length} missions</span>
          <Link to="/dashboard-pro/missions" className="v3-link inline-flex items-center gap-1">
            Tout voir <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      {/* Flotte-only : véhicules + reporting */}
      {isFlotte && vehicleStats.total > 0 && (
        <>
          <div className="v3-section-head">
            <h2>Parc de véhicules</h2>
            <Link to="/dashboard-pro/flotte" className="v3-link inline-flex items-center gap-1">
              Gérer <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {vehicles.slice(0, 6).map(v => {
              const st = v.statut === "en_mission"
                ? { cls: "bg-v3-blue", ring: "shadow-[0_0_0_3px_var(--v3-blue-soft)]", label: "En mission", color: "text-v3-blue" }
                : v.statut === "actif"
                  ? { cls: "bg-[var(--v3-ok)]", ring: "shadow-[0_0_0_3px_var(--v3-ok-soft)]", label: "Disponible", color: "text-[color:var(--v3-ok)]" }
                  : { cls: "bg-[var(--v3-warn)]", ring: "shadow-[0_0_0_3px_var(--v3-warn-soft)]", label: "Immobilisé", color: "text-[color:var(--v3-warn)]" };
              return (
                <div key={v.id} className="v3-card v3-card-hover p-5">
                  <div className="flex justify-between items-start mb-3.5">
                    <div>
                      <div className="font-v3-display text-[14.5px] font-semibold text-v3">{v.marque} {v.modele}</div>
                      <div className="font-v3-mono text-[11px] text-v3-dim mt-0.5">{v.immatriculation ?? "—"}</div>
                    </div>
                    <span className="flex items-center gap-2 text-[12px] font-semibold">
                      <span className={`inline-block w-2 h-2 rounded-full ${st.cls} ${st.ring}`} />
                      <span className={st.color}>{st.label}</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px] text-v3-muted pt-3 border-t border-v3-soft">
                    <span>Voir détail</span>
                    <ArrowUpRight size={12} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bottom : devis + factures + activité */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <MiniListCard title="Derniers devis" icon={FileText} linkTo="/dashboard-pro/documents" empty="Aucun devis récent">
          {devis.slice(0, 5).map(d => (
            <Link key={d.id} to="/dashboard-pro/documents" className="flex items-center justify-between px-5 py-3 border-t border-v3-soft first:border-t-0 hover:bg-v3-surface-2 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-v3 truncate">{d.numero}</p>
                <p className="text-[11.5px] text-v3-muted truncate">{d.depart} → {d.arrivee}</p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="v3-price">{d.prix_estime != null ? `${Number(d.prix_estime).toFixed(0)} €` : "—"}</p>
                <p className="text-[10px] uppercase tracking-wide text-v3-dim">{d.statut}</p>
              </div>
            </Link>
          ))}
        </MiniListCard>

        <MiniListCard title="Dernières factures" icon={Receipt} linkTo="/dashboard-pro/documents" empty="Aucune facture récente">
          {factures.slice(0, 5).map(f => {
            const paid = f.statut === "payee" || f.statut === "paid";
            return (
              <Link key={f.id} to="/dashboard-pro/documents" className="flex items-center justify-between px-5 py-3 border-t border-v3-soft first:border-t-0 hover:bg-v3-surface-2 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-v3 truncate">{f.numero}</p>
                  <p className="text-[11.5px] text-v3-muted">
                    {f.date_facture ? new Date(f.date_facture).toLocaleDateString("fr-FR") : new Date(f.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="v3-price">{f.prix_ttc != null ? `${Number(f.prix_ttc).toFixed(2)} €` : "—"}</p>
                  <p className={`text-[10px] uppercase tracking-wide font-semibold ${paid ? "text-[color:var(--v3-ok)]" : "text-[color:var(--v3-warn)]"}`}>
                    {paid ? "Payée" : f.statut}
                  </p>
                </div>
              </Link>
            );
          })}
        </MiniListCard>
      </div>

      {activity.length > 0 && (
        <div className="v3-card overflow-hidden">
          <div className="px-5 py-4 border-b border-v3-soft flex items-center gap-2">
            <Activity size={16} className="text-v3-blue" />
            <h2 className="font-v3-display font-semibold text-v3 text-[14px]">Activité récente</h2>
          </div>
          <ul>
            {activity.map(a => (
              <li key={a.id} className="px-5 py-3 flex items-start gap-3 border-t border-v3-soft first:border-t-0">
                <div className="w-2 h-2 rounded-full bg-v3-blue mt-2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-v3">{(a.actor_label ?? "Système")} · {a.action.replace(/_/g, " ")} · {a.entity_type}</p>
                  <p className="text-[11px] text-v3-dim mt-0.5">
                    {new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function KpiCard({
  tone, icon, label, value, trend = "flat", trendLabel,
}: {
  tone: "blue" | "gold" | "ok" | "warn" | "violet";
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: "up" | "flat" | "warn";
  trendLabel?: string;
}) {
  return (
    <div className={`v3-kpi-grad ${tone} p-5 sm:p-6`}>
      <div className="flex justify-between items-start mb-3.5 relative z-[1]">
        <div className={`v3-kpi-icon ${tone}`}>{icon}</div>
        {trendLabel && <span className={`v3-kpi-trend ${trend}`}>{trendLabel}</span>}
      </div>
      <div className="v3-kpi-label relative z-[1]">{label}</div>
      <div className="v3-kpi-value relative z-[1]">{value}</div>
    </div>
  );
}


function MiniListCard({
  title, icon: Icon, linkTo, empty, children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  linkTo: string;
  empty: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = arr.filter(Boolean).length === 0;
  return (
    <div className="v3-card overflow-hidden">
      <div className="px-5 py-4 border-b border-v3-soft flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-v3-blue" />
          <h2 className="font-v3-display font-semibold text-v3 text-[14px]">{title}</h2>
        </div>
        <Link to={linkTo} className="v3-link inline-flex items-center gap-1">Tout voir <ArrowUpRight size={12} /></Link>
      </div>
      {isEmpty ? <div className="px-5 py-10 text-center text-v3-muted text-sm">{empty}</div> : <div>{children}</div>}
    </div>
  );
}
