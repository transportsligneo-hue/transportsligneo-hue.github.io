import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Route as RouteIcon,
  Users,
  Truck,
  ArrowRight,
  Receipt,
  Briefcase,
  ClipboardList,
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
import {
  AdminBadge,
  AdminSection,
  AdminEmpty,
} from "@/components/admin/ui";
import { ActiveMissionsMap } from "@/components/map/ActiveMissionsMap";
import { KpiCardV6 } from "@/components/admin/dashboard/KpiCardV6";
import { AreaChartV6 } from "@/components/admin/dashboard/AreaChartV6";
import { RadarEmptyV6 } from "@/components/admin/dashboard/RadarEmptyV6";
import { PageHeader } from "@/components/admin/AdminUI";
import { MissionsAtRiskWidget } from "@/components/admin/alerts/MissionsAtRiskWidget";



export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
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
      supabase.from("trajets").select("id", { count: "exact", head: true }),
      supabase.from("trajets").select("id", { count: "exact", head: true }).in("statut", ["en_cours", "attribue", "accepte", "en_attente_validation"]),
      supabase.from("convoyeurs").select("id", { count: "exact", head: true }).eq("statut", "valide"),
      supabase.from("convoyeurs").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase.from("trajets").select("id", { count: "exact", head: true }).in("statut", ["en_cours", "attribue", "accepte", "en_attente_validation"]),
      supabase.from("trajets").select("id", { count: "exact", head: true }).eq("statut", "termine"),
      supabase.from("devis").select("id", { count: "exact", head: true }),
      supabase.from("devis").select("id", { count: "exact", head: true }).eq("statut", "envoye"),
      supabase.from("documents_convoyeurs").select("id", { count: "exact", head: true }).eq("statut_validation", "en_attente"),
      supabase.from("trajets").select("prix").eq("statut", "termine"),
      supabase.from("trajets").select("prix").eq("statut", "termine").gte("created_at", startMonth),
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

  const hubCards = [
    { to: "/admin/missions", title: "Missions", icon: RouteIcon, count: stats.trajets, accent: "info" as const },
    { to: "/admin/convoyeurs", title: "Convoyeurs", icon: Users, count: stats.convoyeurs, accent: "default" as const },
    { to: "/admin/clients", title: "Clients", icon: Briefcase, count: stats.clients, accent: "info" as const },
    { to: "/admin/devis", title: "Devis", icon: Receipt, count: stats.devisTotal, accent: "danger" as const },
    { to: "/admin/factures", title: "Factures", icon: ClipboardList, count: stats.devisEnvoyes, accent: "warning" as const },
    { to: "/admin/documents", title: "Documents", icon: FolderOpen, count: stats.docsEnAttente, accent: "warning" as const },
    { to: "/admin/notifications", title: "Notifications", icon: BellRing, count: notifs.filter((n) => !n.lu).length, accent: "default" as const },
  ];

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

  return (
    <div className="space-y-6 adm6">
      <PageHeader
        eyebrow="Espace administration"
        title="Tableau de bord"
        subtitle="Vue temps réel de l'activité Transports Ligneo"
      />


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

      {/* === Missions à risque === */}
      <MissionsAtRiskWidget />

      {/* === Carte trajets en cours === */}
      {stats.trajetsActifs > 0 ? (
        <ActiveMissionsMap scope="all" title="Trajets en cours (temps réel)" />
      ) : (
        <div className="a6-card a6-card-hover p-5">
          <p className="inline-flex items-center gap-2 font-bold text-[13.5px] text-[var(--a6-text)]">
            <RouteIcon size={16} className="text-[var(--a6-blue)]" /> Trajets en cours (temps réel)
          </p>
          <RadarEmptyV6 />
        </div>
      )}


      {/* === ALERTES === */}
      {alertes.length > 0 && (
        <AdminSection
          title={
            <span className="inline-flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600" /> À traiter en priorité
            </span>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alertes.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="group flex items-center gap-3 px-4 py-3 rounded-lg border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-2)] hover:border-[color:var(--admin-accent)] transition-all"
              >
                <span className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${toneAlerteIcon[a.tone]}`}>
                  <a.icon size={17} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[color:var(--admin-text)]">{a.title}</p>
                  <p className="text-xs text-[color:var(--admin-muted)]">Action requise</p>
                </div>
                <ChevronRight size={16} className="text-[color:var(--admin-muted)] group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </AdminSection>
      )}

      {/* === DUO : graphe demandes + feed live === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 a6-card a6-card-hover p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="inline-flex items-center gap-2 font-bold text-[13.5px] text-[var(--a6-text)]">
              <TrendingUp size={16} className="text-[var(--a6-blue)]" /> Demandes — 7 derniers jours
            </p>
            <span className="a6-badge new">
              {demandes7j.reduce((s, d) => s + d.count, 0)} au total
            </span>
          </div>
          <p className="text-[11.5px] text-[var(--a6-dim)] mb-2">Volume quotidien réel des demandes reçues</p>
          <AreaChartV6 data={chartData} />
        </div>


        <AdminSection
          title={
            <span className="inline-flex items-center gap-2">
              <BellRing size={16} className="text-[color:var(--admin-accent)]" /> Activité en direct
            </span>
          }
          actions={
            <Link to="/admin/notifications" className="text-xs text-[color:var(--admin-accent)] hover:underline inline-flex items-center gap-1">
              Tout voir <ArrowRight size={12} />
            </Link>
          }
        >
          {notifs.length === 0 ? (
            <AdminEmpty icon={BellRing} title="Aucune notification" description="Les nouveaux événements apparaîtront ici en direct." />
          ) : (
            <ul className="space-y-2">
              {notifs.map((n) => {
                const safeLink = n.link && n.link.startsWith("/") ? n.link : null;
                const Container: React.ElementType = safeLink ? Link : "div";
                const props = safeLink ? { to: safeLink as never } : {};
                return (
                  <li key={n.id}>
                    <Container
                      {...props}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                        n.lu
                          ? "border-[color:var(--admin-border)] bg-transparent"
                          : "border-[color:var(--admin-accent)]/30 bg-[color:var(--admin-accent-soft)]"
                      } ${safeLink ? "hover:border-[color:var(--admin-accent)] cursor-pointer" : ""}`}
                    >
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.lu ? "bg-slate-300" : "bg-[color:var(--admin-accent)]"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[color:var(--admin-text)] truncate">{n.titre}</p>
                        {n.message && (
                          <p className="text-xs text-[color:var(--admin-muted)] line-clamp-2">{n.message}</p>
                        )}
                        <p className="text-[10px] text-[color:var(--admin-muted)] mt-1">
                          {new Date(n.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </Container>
                  </li>
                );
              })}
            </ul>
          )}
        </AdminSection>
      </div>

      {/* === HUB === */}
      <AdminSection title="Sections de gestion" description="Accès rapide à tout l'écosystème">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {hubCards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-xl border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] p-4 hover:border-[color:var(--admin-accent)] hover:shadow-sm transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--admin-accent-soft)] text-[color:var(--admin-accent-strong)]">
                  <c.icon size={17} />
                </span>
                <span className="text-xs font-semibold text-[color:var(--admin-text)]">{c.count}</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-[color:var(--admin-text)]">{c.title}</p>
                <span className="text-[11px] text-[color:var(--admin-muted)] inline-flex items-center gap-1 mt-1 group-hover:text-[color:var(--admin-accent)] transition-colors">
                  Ouvrir <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </AdminSection>

      {/* === DERNIÈRES DEMANDES === */}
      <AdminSection
        title="Dernières demandes"
        actions={
          <Link to="/admin/missions" className="text-xs text-[color:var(--admin-accent)] hover:underline inline-flex items-center gap-1">
            Tout voir <ArrowRight size={12} />
          </Link>
        }
      >
        {recentDemandes.length === 0 ? (
          <AdminEmpty icon={FileText} title="Aucune demande" description="Les nouvelles demandes apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="hidden sm:table-cell">Trajet</th>
                  <th className="hidden lg:table-cell">Téléphone</th>
                  <th>Statut</th>
                  <th className="hidden md:table-cell">Reçue le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentDemandes.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link to="/admin/missions" className="font-medium text-[color:var(--admin-text)] hover:text-[color:var(--admin-accent)]">
                        {d.prenom} {d.nom}
                      </Link>
                      <p className="text-[color:var(--admin-muted)] text-xs sm:hidden">
                        {d.depart} → {d.arrivee}
                      </p>
                    </td>
                    <td className="hidden sm:table-cell text-[color:var(--admin-text)]">
                      <span className="inline-flex items-center gap-1.5">
                        {d.depart}
                        <ArrowRight size={11} className="text-[color:var(--admin-muted)]" />
                        {d.arrivee}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell text-[color:var(--admin-muted)] text-xs font-mono">
                      {d.telephone ?? "—"}
                    </td>
                    <td>
                      <AdminBadge label={statutLabel[d.statut] ?? d.statut} />
                    </td>
                    <td className="hidden md:table-cell text-[color:var(--admin-muted)] text-xs">
                      {new Date(d.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="text-right">
                      <Link
                        to="/admin/missions"
                        className="text-xs text-[color:var(--admin-accent)] hover:underline inline-flex items-center gap-1"
                      >
                        Ouvrir <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>
    </div>
  );
}
