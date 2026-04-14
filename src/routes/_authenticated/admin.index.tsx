import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Route as RouteIcon, Users, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({
    demandes: 0,
    demandesNouvelles: 0,
    trajetsEnCours: 0,
    convoyeursActifs: 0,
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
    async function fetchStats() {
      const [demandes, nouvelles, trajets, convoyeurs] = await Promise.all([
        supabase.from("demandes_convoyage").select("id", { count: "exact", head: true }),
        supabase.from("demandes_convoyage").select("id", { count: "exact", head: true }).eq("statut", "nouvelle"),
        supabase.from("trajets").select("id", { count: "exact", head: true }).in("statut", ["en_cours", "attribue", "accepte"]),
        supabase.from("convoyeurs").select("id", { count: "exact", head: true }).eq("statut", "valide"),
      ]);
      setStats({
        demandes: demandes.count ?? 0,
        demandesNouvelles: nouvelles.count ?? 0,
        trajetsEnCours: trajets.count ?? 0,
        convoyeursActifs: convoyeurs.count ?? 0,
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

    fetchStats();
    fetchRecent();
  }, []);

  const statCards = [
    { label: "Total demandes", value: stats.demandes, icon: FileText, color: "text-primary" },
    { label: "Nouvelles", value: stats.demandesNouvelles, icon: Clock, color: "text-accent" },
    { label: "Trajets en cours", value: stats.trajetsEnCours, icon: RouteIcon, color: "text-green-400" },
    { label: "Convoyeurs actifs", value: stats.convoyeursActifs, icon: Users, color: "text-blue-400" },
  ];

  const statutLabel: Record<string, string> = {
    nouvelle: "Nouvelle",
    a_traiter: "À traiter",
    convertie: "Convertie",
    attribuee: "Attribuée",
    terminee: "Terminée",
    annulee: "Annulée",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Tableau de bord</h1>
        <p className="text-cream/50 text-sm mt-1">Vue globale de votre activité</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="card-premium p-5 rounded">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cream/50 text-xs uppercase tracking-wider">{s.label}</p>
                <p className={`text-3xl font-heading mt-1 ${s.color}`}>{s.value}</p>
              </div>
              <s.icon className={`${s.color} opacity-30`} size={32} />
            </div>
          </div>
        ))}
      </div>

      <div className="card-premium rounded p-6">
        <h2 className="font-heading text-lg text-primary tracking-wider uppercase mb-4">Dernières demandes</h2>
        {recentDemandes.length === 0 ? (
          <p className="text-cream/40 text-sm">Aucune demande pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cream/50 text-xs uppercase tracking-wider border-b border-primary/10">
                  <th className="text-left py-3 px-2">Client</th>
                  <th className="text-left py-3 px-2">Trajet</th>
                  <th className="text-left py-3 px-2">Statut</th>
                  <th className="text-left py-3 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentDemandes.map((d) => (
                  <tr key={d.id} className="border-b border-primary/5 text-cream/80">
                    <td className="py-3 px-2">{d.prenom} {d.nom}</td>
                    <td className="py-3 px-2 text-cream/60">{d.depart} → {d.arrivee}</td>
                    <td className="py-3 px-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-primary/10 text-primary border border-primary/20">
                        {statutLabel[d.statut] ?? d.statut}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-cream/40">
                      {new Date(d.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
