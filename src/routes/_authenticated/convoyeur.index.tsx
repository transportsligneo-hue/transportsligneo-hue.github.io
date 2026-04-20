import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Truck, Clock, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/")({
  component: ConvoyeurDashboard,
});

function ConvoyeurDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ proposed: 0, accepted: 0, inProgress: 0, completed: 0, total: 0 });
  const [convoyeurName, setConvoyeurName] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id, prenom, nom")
        .eq("user_id", user.id)
        .single();

      if (!conv) return;
      setConvoyeurName(`${conv.prenom} ${conv.nom}`);

      const { data: attrs } = await supabase
        .from("attributions")
        .select("statut")
        .eq("convoyeur_id", conv.id);

      if (attrs) {
        setStats({
          proposed: attrs.filter((a) => a.statut === "propose").length,
          accepted: attrs.filter((a) => a.statut === "accepte").length,
          inProgress: attrs.filter((a) => a.statut === "en_cours").length,
          completed: attrs.filter((a) => a.statut === "termine").length,
          total: attrs.length,
        });
      }
    })();
  }, [user]);

  const cards = [
    { label: "Proposées", value: stats.proposed, icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
    { label: "Acceptées", value: stats.accepted, icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
    { label: "En cours", value: stats.inProgress, icon: Truck, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
    { label: "Terminées", value: stats.completed, icon: CheckCircle, color: "text-pro-muted", bg: "bg-pro-bg-soft border-pro-border" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-pro-text">
          Bonjour, {convoyeurName || "Convoyeur"} 👋
        </h1>
        <p className="text-pro-text-soft text-sm mt-1">Votre tableau de bord</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

      {/* Quick actions */}
      {stats.proposed > 0 && (
        <Link
          to="/convoyeur/missions"
          className="flex items-center justify-between p-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-amber-800">{stats.proposed} mission{stats.proposed > 1 ? "s" : ""} en attente de réponse</p>
            <p className="text-xs text-amber-600 mt-0.5">Acceptez ou refusez vos missions proposées</p>
          </div>
          <ArrowRight size={18} className="text-amber-600 shrink-0" />
        </Link>
      )}

      {stats.inProgress > 0 && (
        <Link
          to="/convoyeur/missions"
          className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-emerald-800">Mission en cours</p>
            <p className="text-xs text-emerald-600 mt-0.5">GPS actif · Suivre ma mission</p>
          </div>
          <ArrowRight size={18} className="text-emerald-600 shrink-0" />
        </Link>
      )}
    </div>
  );
}
