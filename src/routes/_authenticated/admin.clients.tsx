import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, Ban, CheckCircle, UserRound, Mail, Phone, Building2, Calendar, MapPin, Truck, Receipt, AlertTriangle } from "lucide-react";
import {
  PageHeader,
  Card,
  Badge,
  Table,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
  IconButton,
  SearchInput,
} from "@/components/admin/AdminUI";
import { getHighestActiveRole } from "@/lib/roles";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/clients")({
  component: AdminClients,
});

interface ClientRow {
  user_id: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  created_at: string;
  actif: boolean;
  missions_count: number;
}


function AdminClients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role, actif, created_at");

    if (!roles || roles.length === 0) {
      setClients([]);
      setLoading(false);
      return;
    }

    const groupedRoles = new Map<string, Array<{ role: string | null; actif?: boolean | null; created_at?: string }>>();
    roles.forEach((role) => {
      const existing = groupedRoles.get(role.user_id) ?? [];
      existing.push(role);
      groupedRoles.set(role.user_id, existing);
    });

    const clientUserIds = Array.from(groupedRoles.entries())
      .filter(([, entries]) => getHighestActiveRole(entries) === "client")
      .map(([userId]) => userId);

    const actifMap = new Map(
      Array.from(groupedRoles.entries()).map(([userId, entries]) => [userId, entries.some((entry) => entry.role === "client" && entry.actif !== false)]),
    );

    if (clientUserIds.length === 0) {
      setClients([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, prenom, nom, email, telephone, created_at")
      .in("user_id", clientUserIds);

    const { data: missionsRaw } = await supabase
      .from("missions")
      .select("user_id")
      .in("user_id", clientUserIds);

    const countMap = new Map<string, number>();
    (missionsRaw ?? []).forEach((m) => {
      countMap.set(m.user_id, (countMap.get(m.user_id) ?? 0) + 1);
    });

    const rows: ClientRow[] = (profiles ?? []).map((p) => ({
      user_id: p.user_id,
      prenom: p.prenom ?? "",
      nom: p.nom ?? "",
      email: p.email,
      telephone: p.telephone,
      created_at: p.created_at,
      actif: actifMap.get(p.user_id) ?? true,
      missions_count: countMap.get(p.user_id) ?? 0,
    }));

    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setClients(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const toggleActif = async (userId: string, nextActif: boolean) => {
    if (
      !nextActif &&
      !window.confirm("Suspendre ce client ? Il ne pourra plus se connecter à son espace.")
    )
      return;
    await supabase
      .from("user_roles")
      .update({ actif: nextActif })
      .eq("user_id", userId)
      .eq("role", "client");
    await fetchClients();
  };

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.prenom.toLowerCase().includes(q) ||
      c.nom.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.telephone ?? "").includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length > 1 ? "s" : ""} inscrit${clients.length > 1 ? "s" : ""}`}
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un client..." />
            <IconButton onClick={fetchClients} title="Actualiser">
              <RefreshCw size={15} />
            </IconButton>
          </>
        }
      />

      {loading ? (
        <Card className="text-center text-pro-muted py-12">Chargement…</Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={search ? "Aucun résultat" : "Aucun client"}
          description={search ? "Essayez une autre recherche." : "Les clients inscrits apparaîtront ici."}
        />
      ) : (
        <Table>
          <THead>
            <TH>Client</TH>
            <TH className="hidden sm:table-cell">Contact</TH>
            <TH className="hidden md:table-cell">Missions</TH>
            <TH className="hidden md:table-cell">Inscrit le</TH>
            <TH>Statut</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <tbody>
            {filtered.map((c) => (
              <TR key={c.user_id}>
                <TD>
                  <Link
                    to="/admin/clients/$clientId"
                    params={{ clientId: c.user_id }}
                    className="flex items-center gap-2 hover:text-pro-accent"
                  >
                    <div className="w-8 h-8 rounded-full bg-pro-accent/10 text-pro-accent flex items-center justify-center text-xs font-semibold shrink-0">
                      {(c.prenom?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-pro-text truncate">
                        {c.prenom} {c.nom}
                      </p>
                      <p className="text-pro-muted text-xs sm:hidden truncate">{c.email}</p>
                    </div>
                  </Link>
                </TD>
                <TD className="hidden sm:table-cell text-pro-text-soft">
                  <p className="text-sm">{c.email}</p>
                  {c.telephone && <p className="text-xs text-pro-muted">{c.telephone}</p>}
                </TD>
                <TD className="hidden md:table-cell text-pro-text-soft">
                  <span className="font-medium">{c.missions_count}</span>
                </TD>
                <TD className="hidden md:table-cell text-pro-muted text-xs">
                  {new Date(c.created_at).toLocaleDateString("fr-FR")}
                </TD>
                <TD>
                  <Badge tone={c.actif ? "success" : "danger"}>
                    {c.actif ? "Actif" : "Suspendu"}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      to="/admin/clients/$clientId"
                      params={{ clientId: c.user_id }}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-pro-accent hover:bg-pro-accent/10"
                      title="Voir la fiche"
                    >
                      <Eye size={15} />
                    </Link>
                    {c.actif ? (
                      <IconButton
                        onClick={() => toggleActif(c.user_id, false)}
                        title="Suspendre"
                        tone="danger"
                      >
                        <Ban size={15} />
                      </IconButton>
                    ) : (
                      <IconButton
                        onClick={() => toggleActif(c.user_id, true)}
                        title="Réactiver"
                        tone="success"
                      >
                        <CheckCircle size={15} />
                      </IconButton>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

    </div>
  );
}
