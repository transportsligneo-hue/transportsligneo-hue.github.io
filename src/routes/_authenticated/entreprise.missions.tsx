import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, missionStatusKind, missionStatusLabel } from "@/components/dashboard/StatusBadge";
import { legRef } from "@/lib/mission-number";
import { MissionViewSwitcher, MissionViewsBody, useMissionView, type MissionViewItem } from "@/components/dashboard/MissionViews";

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
  heure_prise_en_charge?: string | null;
  mission_group_id?: string | null;
  immatriculation?: string | null;
  leg_type?: string | null;
  leg_index?: number | null;
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
        .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, heure_prise_en_charge, statut, prix_total, leg_type, leg_index, mission_group_id, immatriculation")
        .eq("organization_id", mem.organization_id)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as MissionRow[]);
      setLoading(false);
    })();
  }, [user]);

  const [view, setView] = useMissionView("ligneo:view:entreprise-missions:v2");

  const viewItems = useMemo<MissionViewItem[]>(
    () =>
      rows.map((r) => ({
        id: r.id,
        numero: legRef(r.numero, r.leg_type, r.leg_index, r.leg_type === "aller" || r.leg_type === "retour"),
        depart: r.ville_depart,
        arrivee: r.ville_arrivee,
        date: r.date_prise_en_charge,
        heure: r.heure_prise_en_charge ?? null,
        statut: r.statut,
        plaque: r.immatriculation ?? null,
        typeLabel: r.leg_type === "aller" || r.leg_type === "retour" ? "Livraison + Restitution" : "Livraison simple",
        groupKey: r.mission_group_id ?? `solo-${r.id}`,
        legLabel: r.leg_type === "retour" ? "R" : r.leg_type === "aller" ? "L" : null,
        amount: `${Number(r.prix_total).toFixed(2)} €`,
      })),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Missions</h1>
        <p className="text-sm text-pro-muted mt-1">Toutes les missions liées à votre entreprise.</p>
        <div className="mt-3">
          <MissionViewSwitcher view={view} onChange={setView} />
        </div>
      </div>
      {view !== "list" && !loading && rows.length > 0 ? (
        <MissionViewsBody view={view} items={viewItems} />
      ) : (
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
                <TableCell><StatusBadge kind={missionStatusKind(r.statut)}>{missionStatusLabel(r.statut)}</StatusBadge></TableCell>
                <TableCell className="text-right">{Number(r.prix_total).toFixed(2)} €</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      )}
    </div>
  );
}
