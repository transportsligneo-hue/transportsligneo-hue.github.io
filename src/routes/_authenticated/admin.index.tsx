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
  TrendingUp,
  Briefcase,
  ClipboardList,
  ChevronRight,
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
  accent: string; // tailwind classes for icon background
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
    devisTotal: 0,
  });
  const [recentDemandes, setRecentDemandes] = useState<Array<{
    id: string;
    nom: string;
    prenom: string;
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
        devis,
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
        supabase.from("devis").select("id", { count: "exact", head: true }),
      ]);
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
        devisTotal: devis.count ?? 0,
      });
    }

    async function fetchRecent() {
      const { data } = await supabase
        .from("demandes_convoyage")
        .select("id, nom, prenom, depart, arrivee, statut, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setRecentDemandes(data);
    }

    fetchAll();
    fetchRecent();
  }, []);

  const hubCards: HubCard[] = [
    {
      to: "/admin/demandes",
      title: "Demandes",
      description: "Nouvelles demandes de convoyage à traiter",
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
      description: "Planification et gestion des trajets",
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
      description: "Attributions et suivi des missions en cours",
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
      description: "Validation et gestion des convoyeurs",
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
      description: "Comptes particuliers et professionnels",
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
      description: "Devis générés et historique de facturation",
      icon: Receipt,
      count: stats.devisTotal,
      accent: "bg-rose-50 text-rose-600",
    },
    {
      to: "/admin/documents",
      title: "Documents",
      description: "Pièces justificatives convoyeurs à valider",
      icon: FileText,
      count: 0,
      accent: "bg-slate-100 text-slate-600",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle="Accédez rapidement à toutes les sections de gestion"
      />

      {/* === HUB DE NAVIGATION === */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hubCards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="group relative bg-white border border-pro-border rounded-lg p-5 hover:border-pro-accent hover:shadow-md transition-all duration-200 flex flex-col gap-4 min-h-[150px]"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${card.accent} group-hover:scale-110 transition-transform`}
                >
                  <card.icon size={20} />
                </div>
                {card.badge && (
                  <Badge tone={card.badge.tone}>{card.badge.label}</Badge>
                )}
              </div>

              {/* Body */}
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <h3 className="text-pro-text font-semibold text-base">{card.title}</h3>
                  <span className="text-pro-muted text-sm">· {card.count}</span>
                </div>
                <p className="text-pro-muted text-xs leading-relaxed">{card.description}</p>
              </div>

              {/* Footer arrow */}
              <div className="flex items-center justify-between pt-2 border-t border-pro-border/60">
                <span className="text-xs text-pro-muted group-hover:text-pro-accent transition-colors">
                  Accéder
                </span>
                <ChevronRight
                  size={16}
                  className="text-pro-muted group-hover:text-pro-accent group-hover:translate-x-1 transition-all"
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* === DERNIÈRES DEMANDES === */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-pro-text font-semibold flex items-center gap-2">
            <TrendingUp size={16} className="text-pro-accent" />
            Dernières demandes
          </h2>
          <Link
            to="/admin/demandes"
            className="text-xs text-pro-accent hover:underline inline-flex items-center gap-1"
          >
            Toutes les demandes <ArrowRight size={12} />
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
                <TH>Statut</TH>
                <TH className="hidden md:table-cell">Date</TH>
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
                      {d.depart} → {d.arrivee}
                    </TD>
                    <TD>
                      <Badge tone={demandeStatutTone[d.statut] ?? "neutral"}>
                        {statutLabel[d.statut] ?? d.statut}
                      </Badge>
                    </TD>
                    <TD className="hidden md:table-cell text-pro-muted text-xs">
                      {new Date(d.created_at).toLocaleDateString("fr-FR")}
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
