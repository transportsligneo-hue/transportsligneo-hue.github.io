import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { legRef } from "@/lib/mission-number";

export const Route = createFileRoute("/_authenticated/entreprise/missions")({
  component: EntrepriseMissions,
});

interface MissionRow {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  statut: string;
  prix_total: number;
}

function EntrepriseMissions() {
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
        .eq("organization_id", mem.organization_id)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as MissionRow[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Missions</h1>
        <p className="text-sm text-pro-muted mt-1">Toutes les missions liées à votre entreprise.</p>
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
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-pro-muted">Aucune mission</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{legRef(r.numero, r.leg_type, r.leg_index, r.leg_type === "aller" || r.leg_type === "retour")}</TableCell>
                <TableCell>{r.ville_depart} → {r.ville_arrivee}</TableCell>
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
