import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  Truck, Clock, CheckCircle, AlertCircle, ArrowRight,
  Calendar, MapPin, Navigation, Phone, FileText, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/")({
  component: ConvoyeurDashboard,
});

interface TodayMission {
  id: string;
  statut: string;
  trajet: {
    depart: string;
    arrivee: string;
    date_trajet: string | null;
    heure_trajet: string | null;
    marque: string | null;
    modele: string | null;
    immatriculation: string | null;
    client_telephone: string | null;
    client_nom: string | null;
  } | null;
}

function ConvoyeurDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ proposed: 0, accepted: 0, inProgress: 0, completed: 0, total: 0 });
  const [convoyeurName, setConvoyeurName] = useState("");
  const [todayMission, setTodayMission] = useState<TodayMission | null>(null);
  const [nextMission, setNextMission] = useState<TodayMission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id, prenom, nom")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!conv) { setLoading(false); return; }
      setConvoyeurName(`${conv.prenom} ${conv.nom}`);

      const { data: attrs } = await supabase
        .from("attributions")
        .select("id, statut, trajet_id")
        .eq("convoyeur_id", conv.id);

      if (attrs && attrs.length > 0) {
        setStats({
          proposed: attrs.filter((a) => a.statut === "propose").length,
          accepted: attrs.filter((a) => a.statut === "accepte").length,
          inProgress: attrs.filter((a) => a.statut === "en_cours").length,
          completed: attrs.filter((a) => a.statut === "termine").length,
          total: attrs.length,
        });

        // Hydrate today/next missions
        const today = new Date().toISOString().split("T")[0];
        const enriched: TodayMission[] = [];
        for (const a of attrs) {
          if (a.statut === "termine") continue;
          const { data: t } = await supabase
            .from("trajets")
            .select("depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation, client_telephone, client_nom")
            .eq("id", a.trajet_id)
            .maybeSingle();
          enriched.push({ id: a.id, statut: a.statut, trajet: t ?? null });
        }

        // Priority: in_progress > today's > next upcoming
        const inProg = enriched.find(m => m.statut === "en_cours");
        const todayM = enriched.find(m => m.trajet?.date_trajet === today && m.statut !== "en_cours");
        const upcoming = enriched
          .filter(m => m.trajet?.date_trajet && m.trajet.date_trajet > today)
          .sort((a, b) => (a.trajet!.date_trajet! > b.trajet!.date_trajet! ? 1 : -1))[0];

        setTodayMission(inProg ?? todayM ?? null);
        setNextMission(!inProg && !todayM ? upcoming ?? null : upcoming ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const cards = [
    { label: "Proposées", value: stats.proposed, icon: Clock, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
    { label: "Acceptées", value: stats.accepted, icon: AlertCircle, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
    { label: "En cours", value: stats.inProgress, icon: Truck, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    { label: "Terminées", value: stats.completed, icon: CheckCircle, color: "text-pro-muted", bg: "bg-pro-bg-soft border-pro-border" },
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>;
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-pro-text">
          Bonjour, {convoyeurName || "Convoyeur"} 👋
        </h1>
        <p className="text-pro-text-soft text-sm mt-1">Tableau de bord — vos missions en un coup d'œil</p>
      </div>

      {/* Hero : mission active / aujourd'hui */}
      {todayMission && todayMission.trajet && (
        <Link
          to="/convoyeur/missions"
          className="block bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all active:scale-[0.99]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[10px] uppercase tracking-wider font-semibold">
              {todayMission.statut === "en_cours" && (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  En cours
                </>
              )}
              {todayMission.statut === "accepte" && "À démarrer"}
              {todayMission.statut === "propose" && "À accepter"}
            </span>
            <ArrowRight size={18} />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-start gap-2">
              <MapPin size={14} className="mt-1 shrink-0 opacity-70" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider opacity-70">Départ</p>
                <p className="text-sm font-medium truncate">{todayMission.trajet.depart}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Navigation size={14} className="mt-1 shrink-0 opacity-70" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider opacity-70">Arrivée</p>
                <p className="text-sm font-medium truncate">{todayMission.trajet.arrivee}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 opacity-90">
              <Calendar size={12} />
              {todayMission.trajet.date_trajet
                ? new Date(todayMission.trajet.date_trajet).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
                : "Date à définir"}
              {todayMission.trajet.heure_trajet && ` · ${todayMission.trajet.heure_trajet}`}
            </span>
            {todayMission.trajet.immatriculation && (
              <span className="font-mono opacity-90">{todayMission.trajet.immatriculation}</span>
            )}
          </div>
        </Link>
      )}

      {/* Quick actions sur mission active */}
      {todayMission && todayMission.trajet && (
        <div className="grid grid-cols-3 gap-2">
          <a
            href={todayMission.trajet.depart ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(todayMission.trajet.depart)}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 py-3 bg-white border border-pro-border rounded-xl text-pro-text text-xs font-medium hover:bg-pro-bg-soft active:scale-[0.97] transition"
          >
            <Navigation size={18} className="text-blue-600" />
            GPS
          </a>
          <a
            href={todayMission.trajet.client_telephone ? `tel:${todayMission.trajet.client_telephone}` : "#"}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition border ${
              todayMission.trajet.client_telephone
                ? "bg-white border-pro-border text-pro-text hover:bg-pro-bg-soft active:scale-[0.97]"
                : "bg-pro-bg-soft border-pro-border text-pro-muted pointer-events-none"
            }`}
          >
            <Phone size={18} className="text-emerald-600" />
            Appeler
          </a>
          <Link
            to="/convoyeur/missions"
            className="flex flex-col items-center gap-1.5 py-3 bg-white border border-pro-border rounded-xl text-pro-text text-xs font-medium hover:bg-pro-bg-soft active:scale-[0.97] transition"
          >
            <FileText size={18} className="text-amber-600" />
            Détail
          </Link>
        </div>
      )}

      {/* Empty state */}
      {!todayMission && (
        <div className="bg-white border border-pro-border rounded-2xl p-8 text-center shadow-sm">
          <Truck size={36} className="mx-auto text-pro-muted mb-3" />
          <p className="text-pro-text font-medium text-sm">Aucune mission active aujourd'hui</p>
          <p className="text-pro-text-soft text-xs mt-1">Consultez les missions disponibles ou attendez une attribution.</p>
          <Link
            to="/convoyeur/disponibles"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700"
          >
            Voir les missions disponibles <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Stats cards */}
      <div>
        <h2 className="text-pro-text-soft text-xs uppercase tracking-wider font-semibold mb-2">Statistiques</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-xl border p-4 ${c.bg}`}>
              <div className="flex items-center justify-between">
                <c.icon className={c.color} size={20} />
                <span className={`text-2xl font-bold ${c.color}`}>{c.value}</span>
              </div>
              <p className="text-pro-text-soft text-xs mt-2 font-medium">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick alerts */}
      {stats.proposed > 0 && (
        <Link
          to="/convoyeur/missions"
          className="flex items-center justify-between p-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {stats.proposed} mission{stats.proposed > 1 ? "s" : ""} en attente de réponse
            </p>
            <p className="text-xs text-amber-700 mt-0.5">Acceptez ou refusez vos missions proposées</p>
          </div>
          <ArrowRight size={18} className="text-amber-700 shrink-0" />
        </Link>
      )}

      {/* Next mission */}
      {nextMission && nextMission.trajet && nextMission.id !== todayMission?.id && (
        <div>
          <h2 className="text-pro-text-soft text-xs uppercase tracking-wider font-semibold mb-2">Prochaine mission</h2>
          <Link
            to="/convoyeur/missions"
            className="block bg-white border border-pro-border rounded-xl p-4 hover:border-emerald-300 transition-colors shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Calendar size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-pro-text text-sm font-medium truncate">
                  {nextMission.trajet.depart} → {nextMission.trajet.arrivee}
                </p>
                <p className="text-pro-text-soft text-xs mt-0.5">
                  {nextMission.trajet.date_trajet && new Date(nextMission.trajet.date_trajet).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  {nextMission.trajet.heure_trajet && ` à ${nextMission.trajet.heure_trajet}`}
                </p>
              </div>
              <ArrowRight size={16} className="text-pro-muted shrink-0 mt-2" />
            </div>
          </Link>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Link
          to="/convoyeur/disponibles"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-pro-border hover:border-emerald-300 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Truck size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-pro-text text-sm font-medium">Missions dispo</p>
            <p className="text-pro-muted text-xs">Voir le catalogue</p>
          </div>
        </Link>
        <Link
          to="/convoyeur/documents"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-pro-border hover:border-emerald-300 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileText size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-pro-text text-sm font-medium">Mes documents</p>
            <p className="text-pro-muted text-xs">Permis, RIB, KBIS…</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
