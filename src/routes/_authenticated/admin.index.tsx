import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Route as RouteIcon,
  Users,
  Clock,
  Truck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Receipt,
  TrendingUp,
} from "lucide-react";
import {
  PageHeader,
  KpiCard,
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

function AdminDashboard() {
  const [stats, setStats] = useState({
    demandes: 0,
    demandesNouvelles: 0,
    trajetsEnCours: 0,
    convoyeursActifs: 0,
    convoyeursEnAttente: 0,
    missionsEnCours: 0,
    missionsTerminees: 0,
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
  const [activeMissions, setActiveMissions] = useState<Array<{
    id: string;
    convoyeur: string;
    depart: string;
    arrivee: string;
  }>>([]);

  useEffect(() => {
    async function fetchAll() {
      const [demandes, nouvelles, trajets, convoyeurs, convAttente, enCours, terminees, devis] =
        await Promise.all([
          supabase.from("demandes_convoyage").select("id", { count: "exact", head: true }),
          supabase.from("demandes_convoyage").select("id", { count: "exact", head: true }).eq("statut", "nouvelle"),
          supabase.from("trajets").select("id", { count: "exact", head: true }).in("statut", ["en_cours", "attribue", "accepte"]),
          supabase.from("convoyeurs").select("id", { count: "exact", head: true }).eq("statut", "valide"),
          supabase.from("convoyeurs").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
          supabase.from("attributions").select("id", { count: "exact", head: true }).eq("statut", "en_cours"),
          supabase.from("attributions").select("id", { count: "exact", head: true }).eq("statut", "termine"),
          supabase.from("devis").select("id", { count: "exact", head: true }),
        ]);
      setStats({
        demandes: demandes.count ?? 0,
        demandesNouvelles: nouvelles.count ?? 0,
        trajetsEnCours: trajets.count ?? 0,
        convoyeursActifs: convoyeurs.count ?? 0,
        convoyeursEnAttente: convAttente.count ?? 0,
        missionsEnCours: enCours.count ?? 0,
        missionsTerminees: terminees.count ?? 0,
        devisTotal: devis.count ?? 0,
      });
    }

    async function fetchRecent() {
      const { data } = await supabase
        .from("demandes_convoyage")
        .select("id, nom, prenom, depart, arrivee, statut, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (data) setRecentDemandes(data);
    }

    async function fetchActiveMissions() {
      const { data } = await supabase
        .from("attributions")
        .select("id, convoyeur:convoyeurs(prenom, nom), trajet:trajets(depart, arrivee)")
        .eq("statut", "en_cours")
        .limit(5);
      if (data) {
        setActiveMissions(
          data.map((a: any) => ({
            id: a.id,
            convoyeur: a.convoyeur ? `${a.convoyeur.prenom} ${a.convoyeur.nom}` : "—",
            depart: a.trajet?.depart ?? "—",
            arrivee: a.trajet?.arrivee ?? "—",
          })),
        );
      }
    }

    fetchAll();
    fetchRecent();
    fetchActiveMissions();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de l'activité Ligneo"
      />

      {/* KPIs prioritaires */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Nouvelles demandes"
          value={stats.demandesNouvelles}
          icon={Clock}
          tone="warning"
          hint={stats.demandesNouvelles > 0 ? "À traiter" : "Tout est à jour"}
        />
        <KpiCard
          label="Missions en cours"
          value={stats.missionsEnCours}
          icon={Truck}
          tone="info"
        />
        <KpiCard
          label="Convoyeurs actifs"
          value={stats.convoyeursActifs}
          icon={Users}
          tone="success"
        />
        <KpiCard
          label="À valider"
          value={stats.convoyeursEnAttente}
          icon={AlertTriangle}
          tone={stats.convoyeursEnAttente > 0 ? "warning" : "default"}
          hint="Convoyeurs en attente"
        />
      </div>

      {/* KPIs secondaires */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total demandes" value={stats.demandes} icon={FileText} />
        <KpiCard label="Trajets actifs" value={stats.trajetsEnCours} icon={RouteIcon} />
        <KpiCard label="Missions terminées" value={stats.missionsTerminees} icon={CheckCircle2} tone="success" />
        <KpiCard label="Devis générés" value={stats.devisTotal} icon={Receipt} />
      </div>

      {/* Missions en cours */}
      {activeMissions.length > 0 && (
        <Card padded={false}>
          <div className="px-5 py-4 border-b border-pro-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-pro-text font-semibold">Missions en cours</h2>
            </div>
            <Link
              to="/admin/attributions"
              className="text-xs text-pro-accent hover:underline inline-flex items-center gap-1"
            >
              Voir tout <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-pro-border">
            {activeMissions.map((m) => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between hover:bg-pro-bg-soft/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-pro-accent/10 text-pro-accent flex items-center justify-center text-xs font-semibold shrink-0">
                    {m.convoyeur.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-pro-text text-sm font-medium truncate">{m.convoyeur}</p>
                    <p className="text-pro-muted text-xs truncate">
                      {m.depart} → {m.arrivee}
                    </p>
                  </div>
                </div>
                <Badge tone="purple">En cours</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Dernières demandes */}
      <div>
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
        )}
      </div>
    </div>
  );
}
