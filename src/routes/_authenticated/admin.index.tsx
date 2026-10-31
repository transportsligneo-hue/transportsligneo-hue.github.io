import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Users,
  Truck,
  ArrowRight,
  Receipt,
  Briefcase,
  ChevronRight,
  AlertCircle,
  UserCheck,
  FolderOpen,
  Activity,
  Euro,
  Clock,
  BellRing,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { AdminBadge } from "@/components/admin/ui";
import { ExploitationOverview } from "@/components/admin/dashboard/ExploitationOverview";
import { KpiCardV6 } from "@/components/admin/dashboard/KpiCardV6";
import { AreaChartV6 } from "@/components/admin/dashboard/AreaChartV6";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { SmsCreditsCard } from "@/components/admin/SmsCreditsCard";
import { ApiUsageCards } from "@/components/admin/ApiUsageCards";
import { isAdminAppShell } from "@/lib/app-mode";
import { MissionsAtRiskWidget } from "@/components/admin/alerts/MissionsAtRiskWidget";



export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
  head: () => ({ meta: [
    { title: "Tableau de bord exploitation | Transports Ligneo" },
    { name: "description", content: "Supervision des missions et de l'activité de Transports Ligneo." },
    { property: "og:title", content: "Tableau de bord exploitation | Transports Ligneo" },
    { property: "og:description", content: "Supervision des missions et de l'activité de Transports Ligneo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

const statutLabel: Record<string, string> = {
  nouvelle: "Nouvelle",
  a_traiter: "À traiter",
  convertie: "Convertie",
  attribuee: "Attribuée",
  terminee: "Terminée",
  annulee: "Annulée",
};

type RecentDemande = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  depart: string;
  arrivee: string;
  statut: string;
  created_at: string;
};

type Notif = {
  id: string;
  titre: string;
  message: string | null;
  type: string;
  link: string | null;
  lu: boolean;
  created_at: string;
};

type Alerte = {
  to: string;
  icon: LucideIcon;
  title: string;
  tone: "warning" | "danger" | "info";
};

function AdminDashboard() {
  const [stats, setStats] = useState({
    demandes: 0,
    demandesNouvelles: 0,
    trajets: 0,
    trajetsActifs: 0,
    convoyeurs: 0,
    convoyeursEnAttente: 0,
    clients: 0,
    clientsB2B: 0,
    missionsEnCours: 0,
    missionsTerminees: 0,
    devisTotal: 0,
    devisEnvoyes: 0,
    docsEnAttente: 0,
    caTotal: 0,
    caMois: 0,
  });
  const [recentDemandes, setRecentDemandes] = useState<RecentDemande[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [demandes7j, setDemandes7j] = useState<Array<{ day: string; count: number }>>([]);
  const [nativeApp, setNativeApp] = useState(false);
  useEffect(() => { setNativeApp(isAdminAppShell()); }, []);

  async function fetchAll() {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const start7j = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [
      demandes, nouvelles,
      trajets, trajetsActifs,
      convoyeurs, convAttente,
      clients, clientsB2B,
      enCours, terminees,
      devis, devisEnvoyes,
      docsAttente,
      caTermine,
      caMoisRows,
      demandesWeek,
    ] = await Promise.all([
      supabase.from("demandes_convoyage").select("id", { count: "exact", head: true }),
      supabase.from("demandes_convoyage").select("id", { count: "exact", head: true }).gte("created_at", start7j),
      supabase.from("trajets").select("id", { count: "exact", head: true }).or("is_test_data.is.null,is_test_data.eq.false"),
      supabase.from("trajets").select("id", { count: "exact", head: true }).or("is_test_data.is.null,is_test_data.eq.false").in("statut", ["en_cours", "attribue", "accepte", "en_attente_validation"]),
      supabase.from("convoyeurs").select("id", { count: "exact", head: true }).eq("statut", "valide"),
      supabase.from("convoyeurs").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase.from("trajets").select("id", { count: "exact", head: true }).or("is_test_data.is.null,is_test_data.eq.false").in("statut", ["en_cours", "attribue", "accepte", "en_attente_validation"]),
      supabase.from("trajets").select("id", { count: "exact", head: true }).or("is_test_data.is.null,is_test_data.eq.false").eq("statut", "termine"),
      supabase.from("devis").select("id", { count: "exact", head: true }),
      supabase.from("devis").select("id", { count: "exact", head: true }).eq("statut", "envoye"),
      supabase.from("documents_convoyeurs").select("id", { count: "exact", head: true }).eq("statut_validation", "en_attente"),
      supabase.from("trajets").select("prix").or("is_test_data.is.null,is_test_data.eq.false").eq("statut", "termine"),
      supabase.from("trajets").select("prix").or("is_test_data.is.null,is_test_data.eq.false").eq("statut", "termine").gte("created_at", startMonth),
      supabase.from("demandes_convoyage").select("created_at").gte("created_at", start7j),
    ]);

    const ca = (caTermine.data ?? []).reduce(
      (s: number, m: { prix: number | null }) => s + Number(m.prix ?? 0), 0
    );
    const caMois = (caMoisRows.data ?? []).reduce(
      (s: number, m: { prix: number | null }) => s + Number(m.prix ?? 0), 0
    );


    // 7 day buckets
    const buckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      const k = d.toISOString().slice(0, 10);
      buckets[k] = 0;
    }
    (demandesWeek.data ?? []).forEach((r: { created_at: string }) => {
      const k = r.created_at.slice(0, 10);
      if (k in buckets) buckets[k]++;
    });
    setDemandes7j(
      Object.entries(buckets).map(([day, count]) => ({ day, count }))
    );

    setStats({
      demandes: demandes.count ?? 0,
      demandesNouvelles: nouvelles.count ?? 0,
      trajets: trajets.count ?? 0,
      trajetsActifs: trajetsActifs.count ?? 0,
      convoyeurs: convoyeurs.count ?? 0,
      convoyeursEnAttente: convAttente.count ?? 0,
      clients: clients.count ?? 0,
      clientsB2B: clientsB2B.count ?? 0,
      missionsEnCours: enCours.count ?? 0,
      missionsTerminees: terminees.count ?? 0,
      devisTotal: devis.count ?? 0,
      devisEnvoyes: devisEnvoyes.count ?? 0,
      docsEnAttente: docsAttente.count ?? 0,
      caTotal: ca,
      caMois,
    });
  }

  async function fetchRecent() {
    const { data } = await supabase
      .from("demandes_convoyage")
      .select("id, nom, prenom, telephone, depart, arrivee, statut, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    if (data) setRecentDemandes(data);
  }

  async function fetchNotifs() {
    const { data } = await supabase
      .from("admin_notifications")
      .select("id, titre, message, type, link, lu, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    if (data) setNotifs(data);
  }

  useEffect(() => {
    fetchAll();
    fetchRecent();
    fetchNotifs();

    const channel = supabase
      .channel("admin-home-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "missions" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "devis" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "demandes_convoyage" }, () => {
        fetchAll();
        fetchRecent();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, () => fetchNotifs())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const alertes = useMemo<Alerte[]>(
    () =>
      [
        stats.demandesNouvelles > 0 && {
          to: "/admin/missions",
          icon: FileText,
          title: `${stats.demandesNouvelles} nouvelle${stats.demandesNouvelles > 1 ? "s" : ""} demande${stats.demandesNouvelles > 1 ? "s" : ""}`,
          tone: "warning" as const,
        },
        stats.convoyeursEnAttente > 0 && {
          to: "/admin/convoyeurs",
          icon: UserCheck,
          title: `${stats.convoyeursEnAttente} convoyeur${stats.convoyeursEnAttente > 1 ? "s" : ""} à valider`,
          tone: "danger" as const,
        },
        stats.docsEnAttente > 0 && {
          to: "/admin/documents",
          icon: FolderOpen,
          title: `${stats.docsEnAttente} document${stats.docsEnAttente > 1 ? "s" : ""} en attente`,
          tone: "info" as const,
        },
        stats.devisEnvoyes > 0 && {
          to: "/admin/devis",
          icon: Receipt,
          title: `${stats.devisEnvoyes} devis envoyé${stats.devisEnvoyes > 1 ? "s" : ""} en attente`,
          tone: "info" as const,
        },
      ].filter(Boolean) as Alerte[],
    [stats]
  );

  const chartData = demandes7j.map((d) => ({
    label: new Date(d.day).toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 3),
    value: d.count,
  }));
  const serieDemandes = demandes7j.map((d) => d.count);


  const toneAlerteIcon: Record<Alerte["tone"], string> = {
    warning: "bg-[color:var(--admin-warning-soft)] text-amber-700",
    danger: "bg-[color:var(--admin-danger-soft)] text-red-700",
    info: "bg-[color:var(--admin-info-soft)] text-sky-700",
  };

  const totalAlertes = alertes.length;
  const aTraiter = stats.demandesNouvelles + stats.convoyeursEnAttente + stats.docsEnAttente + stats.devisEnvoyes;

  if (nativeApp) {
    const kpis: Array<[string, string | number, string]> = [
      ["Missions actives", stats.missionsEnCours, "/admin/missions"],
      ["Terminées", stats.missionsTerminees, "/admin/historique"],
      ["CA réalisé", `${stats.caTotal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`, "/admin/factures"],
      ["Convoyeurs", stats.convoyeurs, "/admin/convoyeurs"],
      ["Clients", stats.clients, "/admin/clients"],
      ["Demandes", stats.demandesNouvelles, "/admin/demandes"],
    ];
    const toneBg: Record<Alerte["tone"], string> = { danger: "#e5484d", warning: "#e8960c", info: "#2f5fff" };
    return (
      <div className="adm-app-home space-y-3">
        <div className="rounded-3xl overflow-hidden border border-[color:var(--admin-border)] shadow-sm">
          <ExploitationOverview compact />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {kpis.map(([label, value, to]) => (
            <Link key={label} to={to as never} className="rounded-2xl bg-white border border-[color:var(--admin-border)] px-3 py-2.5 active:scale-[0.98] transition-transform">
              <p className="text-[10.5px] font-semibold text-[color:var(--admin-muted)] truncate">{label}</p>
              <p className="text-[19px] font-extrabold text-[color:var(--admin-text)] leading-tight truncate">{value}</p>
            </Link>
          ))}
        </div>
        <MissionsAtRiskWidget hideWhenEmpty />
        <div className="rounded-3xl bg-white border border-[color:var(--admin-border)] overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-[13px] font-extrabold text-[color:var(--admin-text)]">À traiter en priorité</p>
          {alertes.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-[color:var(--admin-muted)]">Tout est à jour.</p>
          ) : alertes.map((a) => (
            <Link key={a.to} to={a.to as never} className="flex items-center gap-3 px-4 py-3 border-t border-[color:var(--admin-border)] active:bg-slate-50">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: toneBg[a.tone] }}><a.icon size={15} /></span>
              <span className="flex-1 min-w-0 text-[13.5px] font-semibold truncate">{a.title}</span>
              <ChevronRight size={16} className="text-[color:var(--admin-muted)]" />
            </Link>
          ))}
        </div>
        <div className="rounded-3xl bg-white border border-[color:var(--admin-border)] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <p className="text-[13px] font-extrabold text-[color:var(--admin-text)]">Activité</p>
            <Link to="/admin/notifications" className="text-xs font-semibold text-[color:var(--admin-accent)]">Tout voir</Link>
          </div>
          {notifs.slice(0, 4).map((n) => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-2.5 border-t border-[color:var(--admin-border)]">
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.lu ? "bg-slate-300" : "bg-[color:var(--admin-accent)]"}`} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">{n.titre}</p>
                {n.message && <p className="text-[11.5px] text-[color:var(--admin-muted)] truncate">{n.message}</p>}
              </div>
            </div>
          ))}
          {notifs.length === 0 && <p className="px-4 pb-4 text-xs text-[color:var(--admin-muted)]">Les événements apparaîtront ici.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 adm6">
      <AdminSectionHeader
        breadcrumb="Tableau de bord"
        eyebrow="Espace administration"
        title="Tableau"
        highlight="de bord"
        stats={[
          { label: "Aujourd'hui", value: new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) },
          { label: "À traiter", value: aTraiter, tone: aTraiter > 0 ? "warn" : "default" },
          { label: "Missions actives", value: stats.missionsEnCours, tone: "accent" },
        ]}
      />
      <div className="flex flex-wrap items-stretch gap-3">
        <SmsCreditsCard />
        <ApiUsageCards />
      </div>

      {/* === KPI === */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCardV6
          to="/admin/missions"
          label="Missions actives"
          value={stats.missionsEnCours}
          icon={Activity}
          tone="ok"
          trend={stats.missionsEnCours > 0 ? { label: "en direct", positive: true } : undefined}
        />
        <KpiCardV6 to="/admin/historique" label="Missions terminées" value={stats.missionsTerminees} icon={Truck} tone="blue" />
        <KpiCardV6
          to="/admin/convoyeurs"
          label="Convoyeurs validés"
          value={stats.convoyeurs}
          icon={Users}
          tone="violet"
          sub={stats.convoyeursEnAttente > 0 ? `+${stats.convoyeursEnAttente} en attente` : undefined}
        />
        <KpiCardV6
          to="/admin/clients"
          label="Clients"
          value={stats.clients}
          icon={Briefcase}
          tone="blue"
          sub={stats.clientsB2B > 0 ? `${stats.clientsB2B} pro` : undefined}
        />
        <KpiCardV6
          to="/admin/factures"
          label="CA réalisé"
          value={`${stats.caTotal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
          icon={Euro}
          tone="gold"
          sub={`${stats.caMois.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € ce mois`}
        />
        <KpiCardV6
          to="/admin/demandes"
          label="Demandes nouvelles"
          value={stats.demandesNouvelles}
          icon={Clock}
          tone="warn"
          series={serieDemandes}
          sub="7 derniers jours"
        />
      </section>

      {/* === Carte en direct + à traiter / activité === */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-3 items-start">
        <ExploitationOverview compact />

        <div className="flex flex-col gap-3">
          <MissionsAtRiskWidget hideWhenEmpty />
          <div className="a6-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--admin-border)]">
              <p className="inline-flex items-center gap-2 font-bold text-[13.5px] text-[var(--a6-text)]">
                <AlertCircle size={16} className="text-amber-600" /> À traiter en priorité
              </p>
              <span className="text-xs font-semibold text-[color:var(--admin-accent)]">{totalAlertes > 0 ? `${aTraiter} actions` : "Tout est à jour"}</span>
            </div>
            {alertes.length === 0 ? (
              <p className="px-4 py-5 text-center text-xs text-[color:var(--admin-muted)]">Rien à traiter pour le moment.</p>
            ) : (
              <ul>
                {alertes.map((a) => (
                  <li key={a.to} className="border-b border-[color:var(--admin-border)] last:border-b-0">
                    <Link to={a.to} className="group flex items-center gap-3 px-4 py-2 hover:bg-[color:var(--admin-accent-soft)] transition-colors">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toneAlerteIcon[a.tone]}`}>
                        <a.icon size={15} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[12.8px] text-[color:var(--admin-text)] truncate">{a.title}</p>
                        <p className="text-[11px] text-[color:var(--admin-muted)]">Action requise</p>
                      </div>
                      <ChevronRight size={15} className="text-[color:var(--admin-muted)] group-hover:translate-x-1 transition-all" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="a6-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--admin-border)]">
              <p className="inline-flex items-center gap-2 font-bold text-[13.5px] text-[var(--a6-text)]">
                <BellRing size={16} className="text-[color:var(--admin-accent)]" /> Activité en direct
              </p>
              <Link to="/admin/notifications" className="text-xs text-[color:var(--admin-accent)] hover:underline inline-flex items-center gap-1">
                Tout voir <ArrowRight size={12} />
              </Link>
            </div>
            {notifs.length === 0 ? (
              <p className="px-4 py-5 text-center text-xs text-[color:var(--admin-muted)]">Les nouveaux événements apparaîtront ici en direct.</p>
            ) : (
              <ul className="max-h-[210px] overflow-y-auto">
                {notifs.map((n) => {
                  const safeLink = n.link && n.link.startsWith("/") ? n.link : null;
                  const Container: React.ElementType = safeLink ? Link : "div";
                  const props = safeLink ? { to: safeLink as never } : {};
                  return (
                    <li key={n.id} className="border-b border-[color:var(--admin-border)] last:border-b-0">
                      <Container {...props} className={`flex items-start gap-3 px-4 py-2 transition-colors ${safeLink ? "hover:bg-[color:var(--admin-accent-soft)] cursor-pointer" : ""}`}>
                        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.lu ? "bg-slate-300" : "bg-[color:var(--admin-accent)]"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-[color:var(--admin-text)] truncate">{n.titre}</p>
                          {n.message && <p className="text-[11px] text-[color:var(--admin-muted)] truncate">{n.message}</p>}
                          <p className="text-[10px] text-[color:var(--admin-muted)]">
                            {new Date(n.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </Container>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* === Demandes 7 jours + dernières demandes === */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-3">
        <div className="a6-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="inline-flex items-center gap-2 font-bold text-[13.5px] text-[var(--a6-text)]">
              <TrendingUp size={16} className="text-[var(--a6-blue)]" /> Demandes · 7 jours
            </p>
            <span className="a6-badge new">{demandes7j.reduce((s, d) => s + d.count, 0)} au total</span>
          </div>
          <div className="[&_svg]:!h-[120px]"><AreaChartV6 data={chartData} /></div>
        </div>

        <div className="a6-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--admin-border)]">
            <p className="font-bold text-[13.5px] text-[var(--a6-text)]">Dernières demandes</p>
            <Link to="/admin/missions" className="text-xs text-[color:var(--admin-accent)] hover:underline inline-flex items-center gap-1">
              Tout voir <ArrowRight size={12} />
            </Link>
          </div>
          {recentDemandes.length === 0 ? (
            <p className="px-4 py-5 text-center text-xs text-[color:var(--admin-muted)]">Les nouvelles demandes apparaîtront ici.</p>
          ) : (
            <ul>
              {recentDemandes.slice(0, 4).map((d) => (
                <li key={d.id} className="border-b border-[color:var(--admin-border)] last:border-b-0">
                  <Link to="/admin/missions" className="grid grid-cols-[1.1fr_2.4fr_auto_auto] items-center gap-3 px-4 py-2 text-[12px] hover:bg-[color:var(--admin-accent-soft)] transition-colors">
                    <span className="font-semibold truncate text-[color:var(--admin-text)]">{d.prenom} {d.nom}</span>
                    <span className="truncate text-[color:var(--admin-muted)]">{d.depart} → {d.arrivee}</span>
                    <AdminBadge label={statutLabel[d.statut] ?? d.statut} />
                    <span className="text-[11px] text-[color:var(--admin-muted)] whitespace-nowrap">{new Date(d.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* === Quotas === */}
      <div className="flex flex-wrap items-stretch gap-3">
        <SmsCreditsCard />
        <ApiUsageCards />
      </div>
    </div>
  );
}
