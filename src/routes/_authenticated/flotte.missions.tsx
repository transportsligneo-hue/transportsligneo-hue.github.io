import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { prefetchMissionTracking } from "@/lib/mission-prefetch";
import { legRef } from "@/lib/mission-number";

export const Route = createFileRoute("/_authenticated/flotte/missions")({
  component: FlotteMissions,
});

interface MissionRow {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  statut: string;
  prix_total: number;
  leg_type?: string | null;
  leg_index?: number | null;
}

function FlotteMissions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mem } = await supabase
        .from("organization_members").select("organization_id")
        .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
      if (!mem) { setLoading(false); return; }
      const { data } = await supabase
        .from("missions")
        .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, leg_type, leg_index")
        .eq("fleet_organization_id", mem.organization_id)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as MissionRow[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Missions assignées</h1>
        <p className="text-sm text-pro-muted mt-1">Missions confiées à votre flotte par Ligneo.</p>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Trajet</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-pro-muted">Chargement…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-pro-muted">Aucune mission assignée</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer hover:bg-pro-bg-soft"
                onMouseEnter={() => prefetchMissionTracking(r.numero, r.id)}
                onFocus={() => prefetchMissionTracking(r.numero, r.id)}
              >
                <TableCell className="font-mono text-xs">
                  <Link to="/flotte/missions/$missionId" params={{ missionId: r.id }} className="text-pro-accent hover:underline">
                    {legRef(r.numero, r.leg_type, r.leg_index, r.leg_type === "aller" || r.leg_type === "retour")}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link to="/flotte/missions/$missionId" params={{ missionId: r.id }}>
                    {r.ville_depart} → {r.ville_arrivee}
                  </Link>
                </TableCell>
                <TableCell>{new Date(r.date_prise_en_charge).toLocaleDateString("fr-FR")}</TableCell>
                <TableCell><Badge variant="outline">{r.statut}</Badge></TableCell>
                <TableCell className="text-right">{Number(r.prix_total).toFixed(2)} €</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
