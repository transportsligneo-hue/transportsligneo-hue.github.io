import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Truck, Users, Calendar, TrendingUp, PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/flotte/")({
  component: FlotteIndex,
});

function FlotteIndex() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ missions: 0, conducteurs: 0, dispos: 0, ca: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mem } = await supabase
        .from("organization_members").select("organization_id")
        .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
      if (!mem) { setLoading(false); return; }
      const orgId = mem.organization_id;

      const [missionsRes, convRes] = await Promise.all([
        supabase.from("missions").select("prix_total", { count: "exact" }).eq("fleet_organization_id", orgId),
        supabase.from("convoyeurs").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      ]);

      const ca = (missionsRes.data ?? []).reduce(
        (s: number, row) => s + Number((row as Record<string, unknown>).prix_total ?? 0), 0,
      );

      setStats({
        missions: missionsRes.count ?? 0,
        conducteurs: convRes.count ?? 0,
        dispos: 0,
        ca,
      });
      setLoading(false);
    })();
  }, [user]);

  const cards = [
    { label: "Missions", value: stats.missions, icon: Truck },
    { label: "Conducteurs", value: stats.conducteurs, icon: Users },
    { label: "Dispos cette semaine", value: stats.dispos, icon: Calendar },
    { label: "CA cumulé", value: `${stats.ca.toFixed(0)} €`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-pro-text">Tableau de bord flotte</h1>
          <p className="text-sm text-pro-muted mt-1">Activité de votre flotte partenaire Ligneo.</p>
        </div>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-pro-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <PlusCircle size={16} /> Nouvelle demande
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-pro-muted uppercase tracking-wider">{c.label}</CardTitle>
              <c.icon size={16} className="text-pro-accent" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-pro-text">{loading ? "…" : c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
