import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Clock, CheckCircle, Calendar, MapPin, PlusCircle, ArrowRight, Loader2 } from "lucide-react";
import { StatusBadge, missionStatusKind, missionStatusLabel } from "@/components/dashboard/StatusBadge";

export const Route = createFileRoute("/_authenticated/dashboard-client/")({
  component: ClientDashboard,
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
}

interface Stats {
  enCours: number;
  terminees: number;
  aVenir: number;
}

function ClientDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ enCours: 0, terminees: 0, aVenir: 0 });
  const [lastMission, setLastMission] = useState<MissionRow | null>(null);
  const [prenom, setPrenom] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // Profil pour le prénom
      const { data: prof } = await supabase
        .from("profiles")
        .select("prenom")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && prof?.prenom) setPrenom(prof.prenom);

      // Missions
      const { data } = await supabase
        .from("missions")
        .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;

      const missions = (data ?? []) as MissionRow[];
      const today = new Date().toISOString().slice(0, 10);
      setStats({
        enCours: missions.filter(m => m.statut === "en_cours").length,
        terminees: missions.filter(m => m.statut === "livree" || m.statut === "terminee").length,
        aVenir: missions.filter(m => m.statut === "confirmee" && m.date_prise_en_charge >= today).length,
      });
      setLastMission(missions[0] ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={28} /></div>;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="card-premium rounded p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.3em] text-primary/80 mb-2">Bienvenue</p>
          <h1 className="font-heading text-2xl md:text-3xl text-cream tracking-wide">
            {prenom ? `Bonjour, ${prenom}` : "Bonjour"}
          </h1>
          <p className="text-cream/50 text-sm mt-2">Voici un aperçu de vos convoyages.</p>
          <Link
            to="/dashboard-client/nouvelle-reservation"
            className="inline-flex items-center gap-2 mt-5 px-6 py-3 bg-primary text-navy font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors"
          >
            <PlusCircle size={16} /> Réserver un convoyage
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-5">
        <StatCard icon={Clock} label="En cours" value={stats.enCours} accent="text-primary" />
        <StatCard icon={Calendar} label="À venir" value={stats.aVenir} accent="text-blue-300" />
        <StatCard icon={CheckCircle} label="Terminées" value={stats.terminees} accent="text-green-300" />
      </div>

      {/* Last mission */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg text-cream tracking-wider">Dernière mission</h2>
          <Link to="/dashboard-client/missions" className="text-xs text-primary hover:text-gold-light transition-colors uppercase tracking-wider">
            Voir tout →
          </Link>
        </div>
        {lastMission ? (
          <Link
            to="/dashboard-client/missions/$missionId"
            params={{ missionId: lastMission.id }}
            className="block card-premium p-5 rounded hover:border-primary/40 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-cream/40 text-xs uppercase tracking-wider">{lastMission.numero}</p>
                <p className="text-cream font-heading text-base mt-1 flex items-center gap-2">
                  <MapPin size={14} className="text-primary" />
                  {lastMission.ville_depart} → {lastMission.ville_arrivee}
                </p>
              </div>
              <StatusBadge kind={missionStatusKind(lastMission.statut)} size="md">
                {missionStatusLabel(lastMission.statut)}
              </StatusBadge>
            </div>
            <div className="flex items-center justify-between text-xs text-cream/50">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(lastMission.date_prise_en_charge).toLocaleDateString("fr-FR")}
              </span>
              <span className="font-heading text-primary text-base">{Number(lastMission.prix_total).toFixed(2)} €</span>
              <ArrowRight size={14} className="text-cream/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        ) : (
          <div className="card-premium p-8 rounded text-center">
            <Truck className="text-cream/20 mx-auto mb-3" size={32} />
            <p className="text-cream/50 text-sm">Aucune mission pour le moment.</p>
            <Link
              to="/dashboard-client/nouvelle-reservation"
              className="inline-block mt-4 text-primary text-xs uppercase tracking-wider hover:text-gold-light transition-colors"
            >
              Réserver maintenant →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Truck; label: string; value: number; accent: string }) {
  return (
    <div className="card-premium p-4 md:p-5 rounded">
      <Icon className={`${accent} opacity-70 mb-2`} size={20} />
      <p className={`font-heading text-2xl md:text-3xl ${accent}`}>{value}</p>
      <p className="text-cream/50 text-[10px] md:text-xs uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
