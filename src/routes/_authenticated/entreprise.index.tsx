import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Truck, Users, FileText, TrendingUp, PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiveMissionsMap } from "@/components/map/ActiveMissionsMap";

export const Route = createFileRoute("/_authenticated/entreprise/")({
  component: EntrepriseIndex,
});

function EntrepriseIndex() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ missions: 0, membres: 0, demandes: 0, ca: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mem } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!mem) return;
      const orgId = mem.organization_id;

      const [missionsRes, membresRes, demandesRes] = await Promise.all([
        supabase.from("missions").select("prix_total", { count: "exact" }).eq("organization_id", orgId),
        supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
        supabase.from("b2b_transport_requests").select("estimated_price_ttc", { count: "exact" }).eq("organization_id", orgId),
      ]);

      const sum = (arr: unknown[], key: string) =>
        arr.reduce((s: number, row) => s + Number((row as Record<string, unknown>)[key] ?? 0), 0);
      const ca = sum(missionsRes.data ?? [], "prix_total") + sum(demandesRes.data ?? [], "estimated_price_ttc");

      setStats({
        missions: missionsRes.count ?? 0,
        membres: membresRes.count ?? 0,
        demandes: demandesRes.count ?? 0,
        ca,
      });
      setLoading(false);
    })();
  }, [user]);

  const cards = [
    { label: "Missions", value: stats.missions, icon: Truck },
    { label: "Demandes B2B", value: stats.demandes, icon: FileText },
    { label: "Membres actifs", value: stats.membres, icon: Users },
    { label: "CA cumulé", value: `${stats.ca.toFixed(0)} €`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-pro-text">Tableau de bord</h1>
          <p className="text-sm text-pro-muted mt-1">Vue d'ensemble de l'activité de votre entreprise.</p>
        </div>
        <Link
          to="/reserver"
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
