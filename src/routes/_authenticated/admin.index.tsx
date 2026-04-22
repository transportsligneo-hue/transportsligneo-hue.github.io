import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  type LucideIcon,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Badge,
  Table,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
  demandeStatutTone,
} from "@/components/admin/AdminUI";

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

type HubCard = {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  count: number;
  badge?: { label: string; tone: "warning" | "info" | "success" | "danger" };
  accent: string;
};

type Alerte = {
  to: string;
  icon: LucideIcon;
  title: string;
  count: number;
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
  });
  const [recentDemandes, setRecentDemandes] = useState<Array<{
    id: string;
    nom: string;
    prenom: string;
    telephone: string | null;
    depart: string;
    arrivee: string;
    statut: string;
    created_at: string;
  }>>([]);

  useEffect(() => {
    async function fetchAll() {
      const [
        demandes,
        nouvelles,
        trajets,
        trajetsActifs,
        convoyeurs,
        convAttente,
        clients,
        clientsB2B,
        enCours,
        terminees,
        devis,
        devisEnvoyes,
        docsAttente,
        missionsTerm,
      ] = await Promise.all([
        supabase.from("demandes_convoyage").select("id", { count: "exact", head: true }),
        supabase.from("demandes_convoyage").select("id", { count: "exact", head: true }).eq("statut", "nouvelle"),
        supabase.from("trajets").select("id", { count: "exact", head: true }),
        supabase.from("trajets").select("id", { count: "exact", head: true }).in("statut", ["en_cours", "attribue", "accepte"]),
        supabase.from("convoyeurs").select("id", { count: "exact", head: true }).eq("statut", "valide"),
        supabase.from("convoyeurs").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("type_client", "b2b"),
        supabase.from("attributions").select("id", { count: "exact", head: true }).eq("statut", "en_cours"),
        supabase.from("attributions").select("id", { count: "exact", head: true }).eq("statut", "termine"),
        supabase.from("devis").select("id", { count: "exact", head: true }),
        supabase.from("devis").select("id", { count: "exact", head: true }).eq("statut", "envoye"),
        supabase.from("documents_convoyeurs").select("id", { count: "exact", head: true }).eq("statut_validation", "en_attente"),
        supabase.from("missions").select("prix_total").in("statut", ["livree", "terminee"]),
      ]);

      const ca = (missionsTerm.data ?? []).reduce(
        (sum: number, m: { prix_total: number | null }) => sum + Number(m.prix_total ?? 0),
        0
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

    fetchAll();
    fetchRecent();
  }, []);

  const alertes: Alerte[] = [
    stats.demandesNouvelles > 0 && {
      to: "/admin/demandes",
      icon: FileText,
      title: `${stats.demandesNouvelles} nouvelle${stats.demandesNouvelles > 1 ? "s" : ""} demande${stats.demandesNouvelles > 1 ? "s" : ""}`,
      count: stats.demandesNouvelles,
      tone: "warning" as const,
    },
    stats.convoyeursEnAttente > 0 && {
      to: "/admin/convoyeurs",
      icon: UserCheck,
      title: `${stats.convoyeursEnAttente} convoyeur${stats.convoyeursEnAttente > 1 ? "s" : ""} à valider`,
      count: stats.convoyeursEnAttente,
      tone: "danger" as const,
    },
    stats.docsEnAttente > 0 && {
      to: "/admin/documents",
      icon: FolderOpen,
      title: `${stats.docsEnAttente} document${stats.docsEnAttente > 1 ? "s" : ""} en attente`,
      count: stats.docsEnAttente,
      tone: "info" as const,
    },
    stats.devisEnvoyes > 0 && {
      to: "/admin/devis",
      icon: Receipt,
      title: `${stats.devisEnvoyes} devis envoyé${stats.devisEnvoyes > 1 ? "s" : ""} en attente`,
      count: stats.devisEnvoyes,
      tone: "info" as const,
    },
  ].filter(Boolean) as Alerte[];

  const hubCards: HubCard[] = [
    {
      to: "/admin/demandes",
      title: "Demandes",
      description: "Demandes de convoyage entrantes",
      icon: ClipboardList,
      count: stats.demandes,
      badge:
        stats.demandesNouvelles > 0
          ? { label: `${stats.demandesNouvelles} nouvelle${stats.demandesNouvelles > 1 ? "s" : ""}`, tone: "warning" }
          : undefined,
      accent: "bg-amber-50 text-amber-600",
    },
    {
      to: "/admin/trajets",
      title: "Trajets",
      description: "Planification et publication",
      icon: RouteIcon,
      count: stats.trajets,
      badge:
        stats.trajetsActifs > 0
          ? { label: `${stats.trajetsActifs} actif${stats.trajetsActifs > 1 ? "s" : ""}`, tone: "info" }
          : undefined,
      accent: "bg-blue-50 text-blue-600",
    },
    {
      to: "/admin/attributions",
      title: "Missions",
      description: "Suivi des missions en cours",
      icon: Truck,
      count: stats.missionsEnCours,
      badge:
        stats.missionsEnCours > 0
          ? { label: "En cours", tone: "success" }
          : undefined,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      to: "/admin/convoyeurs",
      title: "Convoyeurs",
      description: "Validation et gestion du staff",
      icon: Users,
      count: stats.convoyeurs,
      badge:
        stats.convoyeursEnAttente > 0
          ? { label: `${stats.convoyeursEnAttente} à valider`, tone: "warning" }
          : undefined,
      accent: "bg-violet-50 text-violet-600",
    },
    {
      to: "/admin/clients",
      title: "Clients",
      description: "Particuliers et professionnels",
      icon: Briefcase,
      count: stats.clients,
      badge:
        stats.clientsB2B > 0
          ? { label: `${stats.clientsB2B} B2B`, tone: "info" }
          : undefined,
      accent: "bg-sky-50 text-sky-600",
    },
    {
      to: "/admin/devis",
      title: "Devis & Facturation",
      description: "Devis et historique facturation",
      icon: Receipt,
      count: stats.devisTotal,
      accent: "bg-rose-50 text-rose-600",
    },
    {
      to: "/admin/documents",
      title: "Documents",
      description: "Pièces convoyeurs à valider",
      icon: FolderOpen,
      count: stats.docsEnAttente,
      badge:
        stats.docsEnAttente > 0
          ? { label: "À valider", tone: "warning" }
          : undefined,
      accent: "bg-slate-100 text-slate-600",
    },
  ];

  const toneAlerte: Record<Alerte["tone"], string> = {
    warning: "border-l-amber-500 bg-amber-50/50 hover:bg-amber-50",
    danger: "border-l-red-500 bg-red-50/50 hover:bg-red-50",
    info: "border-l-blue-500 bg-blue-50/50 hover:bg-blue-50",
  };
  const toneAlerteIcon: Record<Alerte["tone"], string> = {
    warning: "text-amber-600 bg-amber-100",
    danger: "text-red-600 bg-red-100",
    info: "text-blue-600 bg-blue-100",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de l'activité Transports Ligneo"
      />

      {/* === KPI STRIP (style Stripe / Qonto) === */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiTile
          icon={Activity}
          label="Missions actives"
          value={stats.missionsEnCours}
          tone="emerald"
        />
        <KpiTile
          icon={Truck}
          label="Missions terminées"
          value={stats.missionsTerminees}
          tone="blue"
        />
        <KpiTile
          icon={Users}
          label="Convoyeurs validés"
          value={stats.convoyeurs}
          hint={stats.convoyeursEnAttente > 0 ? `+${stats.convoyeursEnAttente} en attente` : undefined}
          tone="violet"
        />
        <KpiTile
          icon={Briefcase}
          label="Clients actifs"
          value={stats.clients}
          hint={stats.clientsB2B > 0 ? `${stats.clientsB2B} pro` : undefined}
          tone="sky"
        />
        <KpiTile
          icon={Euro}
          label="CA réalisé"
          value={`${stats.caTotal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
          tone="gold"
          premium
        />
        <KpiTile
          icon={Clock}
          label="Demandes nouvelles"
          value={stats.demandesNouvelles}
          tone="amber"
        />
      </section>

      {/* === ALERTES À TRAITER === */}
      {alertes.length > 0 && (
        <section>
          <h2 className="text-pro-text font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertCircle size={15} className="text-amber-600" />
            À traiter en priorité
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alertes.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={`group flex items-center gap-3 px-4 py-3 bg-white border border-pro-border border-l-4 rounded-md transition-all ${toneAlerte[a.tone]}`}
              >
                <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${toneAlerteIcon[a.tone]}`}>
                  <a.icon size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-pro-text font-medium text-sm">{a.title}</p>
                  <p className="text-pro-muted text-xs">Action requise</p>
                </div>
                <ChevronRight
                  size={16}
                  className="text-pro-muted group-hover:translate-x-1 group-hover:text-pro-text transition-all shrink-0"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* === HUB DE NAVIGATION === */}
      <section>
        <h2 className="text-pro-text font-semibold text-sm mb-3">Sections de gestion</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {hubCards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="group relative bg-white border border-pro-border rounded-xl p-4 shadow-pro-card hover:shadow-pro-card-hover hover:border-pro-accent/40 transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.accent}`}
                >
                  <card.icon size={18} />
                </div>
                {card.badge && (
                  <Badge tone={card.badge.tone}>{card.badge.label}</Badge>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <h3 className="text-pro-text font-semibold text-[15px]">{card.title}</h3>
                  <span className="text-pro-muted text-xs font-medium">· {card.count}</span>
                </div>
                <p className="text-pro-muted text-xs leading-relaxed">{card.description}</p>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-pro-border/60">
                <span className="text-xs text-pro-text-soft group-hover:text-pro-accent inline-flex items-center gap-1 transition-colors">
                  Ouvrir
                  <ChevronRight
                    size={13}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* === DERNIÈRES DEMANDES === */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-pro-text font-semibold text-sm">Dernières demandes</h2>
          <Link
            to="/admin/demandes"
            className="text-xs text-pro-accent hover:underline inline-flex items-center gap-1"
          >
            Tout voir <ArrowRight size={12} />
          </Link>
        </div>
        {recentDemandes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucune demande"
            description="Les nouvelles demandes apparaîtront ici."
          />
        ) : (
          <Card padded={false}>
            <Table>
              <THead>
                <TH>Client</TH>
                <TH className="hidden sm:table-cell">Trajet</TH>
                <TH className="hidden lg:table-cell">Téléphone</TH>
                <TH>Statut</TH>
                <TH className="hidden md:table-cell">Reçue le</TH>
              </THead>
              <tbody>
                {recentDemandes.map((d) => (
                  <TR key={d.id}>
                    <TD>
                      <p className="font-medium text-pro-text">
                        {d.prenom} {d.nom}
                      </p>
                      <p className="text-pro-muted text-xs sm:hidden">
                        {d.depart} → {d.arrivee}
                      </p>
                    </TD>
                    <TD className="hidden sm:table-cell text-pro-text-soft">
                      <span className="inline-flex items-center gap-1.5">
                        {d.depart}
                        <ArrowRight size={11} className="text-pro-muted" />
                        {d.arrivee}
                      </span>
                    </TD>
                    <TD className="hidden lg:table-cell text-pro-text-soft text-xs font-mono">
                      {d.telephone ?? "—"}
                    </TD>
                    <TD>
                      <Badge tone={demandeStatutTone[d.statut] ?? "neutral"}>
                        {statutLabel[d.statut] ?? d.statut}
                      </Badge>
                    </TD>
                    <TD className="hidden md:table-cell text-pro-muted text-xs">
                      {new Date(d.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}

/* ============= KpiTile (premium SaaS look) ============= */
function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  premium = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone: "amber" | "blue" | "emerald" | "violet" | "sky" | "gold";
  premium?: boolean;
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
    gold: "bg-pro-gold-soft text-pro-gold",
  };
  return (
    <div
      className={`bg-white rounded-xl p-4 shadow-pro-card hover:shadow-pro-card-hover transition-shadow ${
        premium ? "border border-pro-gold ring-1 ring-pro-gold/20" : "border border-pro-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
          <Icon size={17} />
        </div>
        {premium && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-pro-gold bg-pro-gold-soft px-1.5 py-0.5 rounded">
            Premium
          </span>
        )}
      </div>
      <p className="text-pro-muted text-[11px] uppercase tracking-wider font-medium truncate">
        {label}
      </p>
      <p className="text-pro-text text-2xl font-semibold leading-tight mt-1">{value}</p>
      {hint && <p className="text-pro-muted text-[11px] mt-1 truncate">{hint}</p>}
    </div>
  );
}
