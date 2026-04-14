import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Truck, Clock, CheckCircle, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/")({
  component: ConvoyeurDashboard,
});

function ConvoyeurDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ proposed: 0, accepted: 0, completed: 0, total: 0 });
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
          completed: attrs.filter((a) => a.statut === "termine").length,
          total: attrs.length,
        });
      }
    })();
  }, [user]);

  const cards = [
    { label: "Proposées", value: stats.proposed, icon: Clock, color: "text-yellow-400" },
    { label: "Acceptées", value: stats.accepted, icon: Truck, color: "text-blue-400" },
    { label: "Terminées", value: stats.completed, icon: CheckCircle, color: "text-green-400" },
    { label: "Total missions", value: stats.total, icon: AlertCircle, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">
          Bonjour, {convoyeurName || "Convoyeur"}
        </h1>
        <p className="text-cream/50 text-sm mt-1">Votre tableau de bord</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card-premium p-4 rounded">
            <c.icon className={c.color} size={20} />
            <p className="text-2xl font-heading text-cream mt-2">{c.value}</p>
            <p className="text-cream/50 text-xs mt-1">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
