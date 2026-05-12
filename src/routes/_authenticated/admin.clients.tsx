import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, Ban, CheckCircle, UserRound, User, Phone, Mail, Briefcase } from "lucide-react";
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
import {
  AdminDetailDrawer,
  DrawerSection,
  DrawerGrid,
  DrawerField,
  DrawerBadge,
} from "@/components/admin/AdminDetailDrawer";

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


interface ClientHistory {
  devis: Array<{ id: string; numero: string; created_at: string; statut: string; prix_estime: number }>;
  missions: Array<{ id: string; numero: string | null; statut: string; created_at: string }>;
  factures: Array<{ id: string; numero: string; prix_ttc: number; statut: string; date_facture: string }>;
}

function AdminClients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [history, setHistory] = useState<ClientHistory>({ devis: [], missions: [], factures: [] });

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

  const openClient = async (c: ClientRow) => {
    setSelected(c);
    setHistory({ devis: [], missions: [], factures: [] });
    const [devisRes, missionsRes, facturesRes] = await Promise.all([
      supabase
        .from("devis")
        .select("id, numero, created_at, statut, prix_estime")
        .eq("email", c.email ?? "")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("missions")
        .select("id, numero, statut, created_at")
        .eq("user_id", c.user_id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("factures")
        .select("id, numero, prix_ttc, statut, date_facture")
        .eq("client_email", c.email ?? "")
        .order("date_facture", { ascending: false })
        .limit(20),
    ]);
    setHistory({
      devis: (devisRes.data ?? []) as ClientHistory["devis"],
      missions: (missionsRes.data ?? []) as ClientHistory["missions"],
      factures: (facturesRes.data ?? []) as ClientHistory["factures"],
    });
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
              <TR key={c.user_id} className="cursor-pointer" onClick={() => openClient(c)}>
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
                <TD onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton onClick={() => openClient(c)} title="Voir la fiche" tone="primary">
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

      <AdminDetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        badge={
          selected ? (
            <DrawerBadge tone={selected.actif ? "green" : "red"}>
              {selected.actif ? "Compte actif" : "Compte suspendu"}
            </DrawerBadge>
          ) : null
        }
        title={selected ? `${selected.prenom} ${selected.nom}` : ""}
        subtitle={selected?.email ?? ""}
        footer={
          selected ? (
            <div className="flex gap-2 justify-end">
              {selected.actif ? (
                <button
                  onClick={() => toggleActif(selected.user_id, false)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-400/40 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 text-sm font-medium text-red-200"
                >
                  <Ban size={14} /> Suspendre
                </button>
              ) : (
                <button
                  onClick={() => toggleActif(selected.user_id, true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-sm font-medium text-white"
                >
                  <CheckCircle size={14} /> Réactiver
                </button>
              )}
            </div>
          ) : null
        }
      >
        {selected ? (
          <>
            <DrawerSection title="Identité" icon={<User size={12} />}>
              <DrawerGrid>
                <DrawerField label="Prénom" value={selected.prenom} />
                <DrawerField label="Nom" value={selected.nom} />
                <DrawerField label="Email" value={selected.email || "—"} />
                <DrawerField label="Téléphone" value={selected.telephone || "—"} />
                <DrawerField
                  label="Inscrit le"
                  value={new Date(selected.created_at).toLocaleString("fr-FR")}
                />
                <DrawerField label="ID utilisateur" value={selected.user_id} mono />
              </DrawerGrid>
            </DrawerSection>

            <DrawerSection title={`Devis (${history.devis.length})`} icon={<Briefcase size={12} />}>
              {history.devis.length === 0 ? (
                <p className="text-sm text-white/50">Aucun devis.</p>
              ) : (
                <ul className="space-y-2">
                  {history.devis.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between text-sm bg-white/5 rounded-md px-3 py-2"
                    >
                      <span className="font-mono text-blue-200 text-xs">{d.numero}</span>
                      <span className="text-white/70">{d.statut}</span>
                      <span className="text-white/90">{Number(d.prix_estime ?? 0).toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
              )}
            </DrawerSection>

            <DrawerSection title={`Missions (${history.missions.length})`} icon={<Briefcase size={12} />}>
              {history.missions.length === 0 ? (
                <p className="text-sm text-white/50">Aucune mission.</p>
              ) : (
                <ul className="space-y-2">
                  {history.missions.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between text-sm bg-white/5 rounded-md px-3 py-2"
                    >
                      <span className="font-mono text-blue-200 text-xs">{m.numero ?? m.id.slice(0, 8)}</span>
                      <span className="text-white/70">{m.statut}</span>
                      <span className="text-white/50 text-xs">
                        {new Date(m.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DrawerSection>

            <DrawerSection title={`Factures (${history.factures.length})`} icon={<Briefcase size={12} />}>
              {history.factures.length === 0 ? (
                <p className="text-sm text-white/50">Aucune facture.</p>
              ) : (
                <ul className="space-y-2">
                  {history.factures.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between text-sm bg-white/5 rounded-md px-3 py-2"
                    >
                      <span className="font-mono text-blue-200 text-xs">{f.numero}</span>
                      <span className="text-white/70">{f.statut}</span>
                      <span className="text-white/90">{Number(f.prix_ttc ?? 0).toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
              )}
            </DrawerSection>
          </>
        ) : null}
      </AdminDetailDrawer>
    </div>
  );
}
