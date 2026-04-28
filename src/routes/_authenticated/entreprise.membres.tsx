import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/entreprise/membres")({
  component: EntrepriseMembres,
});

interface MemberRow {
  id: string;
  user_id: string;
  member_role: string;
  status: string;
  joined_at: string | null;
  email?: string;
  nom?: string;
  prenom?: string;
}

function EntrepriseMembres() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: mem } = await supabase
      .from("organization_members").select("organization_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    if (!mem) { setLoading(false); return; }

    const { data: members } = await supabase
      .from("organization_members")
      .select("id, user_id, member_role, status, joined_at")
      .eq("organization_id", mem.organization_id);

    const userIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, prenom, nom")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    setRows((members ?? []).map((m) => ({
      ...m,
      ...byUser.get(m.user_id),
    })) as MemberRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Membres de l'entreprise</h1>
        <p className="text-sm text-pro-muted mt-1">Liste des collaborateurs ayant accès au compte entreprise.</p>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Depuis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-pro-muted">Chargement…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-pro-muted">Aucun membre</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{[r.prenom, r.nom].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell className="text-pro-muted">{r.email ?? "—"}</TableCell>
                <TableCell><Badge variant="secondary">{r.member_role}</Badge></TableCell>
                <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                <TableCell className="text-pro-muted text-sm">
                  {r.joined_at ? new Date(r.joined_at).toLocaleDateString("fr-FR") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-pro-muted">
        Pour ajouter un membre, contactez l'administrateur Ligneo. La gestion en libre-service arrive bientôt.
      </p>
    </div>
  );
}
