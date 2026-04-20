import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, Ban, CheckCircle, UserRound } from "lucide-react";
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
  Modal,
  DetailRow,
  Button,
  IconButton,
  SearchInput,
} from "@/components/admin/AdminUI";

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

interface MissionItem {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  statut: string;
  prix_total: number;
}

const missionTone: Record<string, "neutral" | "info" | "primary" | "success" | "danger"> = {
  en_attente: "neutral",
  confirmee: "info",
  en_cours: "primary",
  livree: "success",
  terminee: "success",
  annulee: "danger",
  refuse: "danger",
};
const missionLabel: Record<string, string> = {
  en_attente: "En attente",
  confirmee: "Confirmée",
  en_cours: "En cours",
  livree: "Livrée",
  terminee: "Terminée",
  annulee: "Annulée",
  refuse: "Refusée",
};

function AdminClients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, actif, created_at")
      .eq("role", "client");

    if (!roles || roles.length === 0) {
      setClients([]);
      setLoading(false);
      return;
    }

    const userIds = roles.map((r) => r.user_id);
    const actifMap = new Map(roles.map((r) => [r.user_id, r.actif]));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, prenom, nom, email, telephone, created_at")
      .in("user_id", userIds);

    const { data: missionsRaw } = await supabase
      .from("missions")
      .select("user_id")
      .in("user_id", userIds);

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

  useEffect(() => {
    if (!selected) {
      setMissions([]);
      return;
    }
    let cancelled = false;
    setLoadingMissions(true);
    supabase
      .from("missions")
      .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total")
      .eq("user_id", selected.user_id)
      .order("date_prise_en_charge", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled) {
          setMissions((data as MissionItem[]) ?? []);
          setLoadingMissions(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

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
    if (selected?.user_id === userId)
      setSelected((prev) => (prev ? { ...prev, actif: nextActif } : null));
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
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-pro-accent/10 text-pro-accent flex items-center justify-center text-xs font-semibold shrink-0">
                      {(c.prenom?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-pro-text truncate">
                        {c.prenom} {c.nom}
                      </p>
                      <p className="text-pro-muted text-xs sm:hidden truncate">{c.email}</p>
                    </div>
                  </div>
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
                    <IconButton onClick={() => setSelected(c)} title="Voir" tone="primary">
                      <Eye size={15} />
                    </IconButton>
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

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.prenom} ${selected.nom}` : ""}
        size="lg"
      >
        {selected && (
          <>
            <Card padded={false} className="mb-4">
              <div className="px-4 grid sm:grid-cols-2 gap-x-6">
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="Téléphone" value={selected.telephone} />
                <DetailRow label="Missions" value={selected.missions_count} />
                <DetailRow
                  label="Inscrit le"
                  value={new Date(selected.created_at).toLocaleDateString("fr-FR")}
                />
              </div>
            </Card>

            <div className="flex items-center justify-between mb-4">
              <Badge tone={selected.actif ? "success" : "danger"}>
                {selected.actif ? "Compte actif" : "Compte suspendu"}
              </Badge>
              {selected.actif ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => toggleActif(selected.user_id, false)}
                  icon={<Ban size={13} />}
                >
                  Suspendre
                </Button>
              ) : (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => toggleActif(selected.user_id, true)}
                  icon={<CheckCircle size={13} />}
                >
                  Réactiver
                </Button>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-pro-text-soft mb-2">
                Historique missions {missions.length > 0 && `(${missions.length})`}
              </h4>
              {loadingMissions ? (
                <p className="text-pro-muted text-sm">Chargement…</p>
              ) : missions.length === 0 ? (
                <p className="text-pro-muted text-sm">Ce client n'a pas encore de mission.</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {missions.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-pro-bg-soft/50 border border-pro-border text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-pro-text truncate">
                          {m.ville_depart} → {m.ville_arrivee}
                        </p>
                        <p className="text-pro-muted text-xs">
                          {m.numero} · {new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}
                          {m.prix_total > 0 && ` · ${m.prix_total} €`}
                        </p>
                      </div>
                      <Badge tone={missionTone[m.statut] ?? "neutral"}>
                        {missionLabel[m.statut] ?? m.statut}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
