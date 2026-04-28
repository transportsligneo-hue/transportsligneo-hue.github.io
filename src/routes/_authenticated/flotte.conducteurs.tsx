import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/flotte/conducteurs")({
  component: FlotteConducteurs,
});

interface ConducteurRow {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string | null;
  type_convoyeur: string;
  statut: string;
}

function FlotteConducteurs() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ConducteurRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mem } = await supabase
        .from("organization_members").select("organization_id")
        .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
      if (!mem) { setLoading(false); return; }
      const { data } = await supabase
        .from("convoyeurs")
        .select("id, prenom, nom, email, telephone, ville, type_convoyeur, statut")
        .eq("organization_id", mem.organization_id)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as ConducteurRow[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Conducteurs</h1>
        <p className="text-sm text-pro-muted mt-1">Convoyeurs rattachés à votre flotte.</p>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conducteur</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-pro-muted">Chargement…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-pro-muted">Aucun conducteur rattaché</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.prenom} {r.nom}</TableCell>
                <TableCell className="text-pro-muted">{r.email}</TableCell>
                <TableCell className="text-pro-muted">{r.telephone}</TableCell>
                <TableCell>{r.ville ?? "—"}</TableCell>
                <TableCell><Badge variant="secondary">{r.type_convoyeur}</Badge></TableCell>
                <TableCell><Badge variant="outline">{r.statut}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
