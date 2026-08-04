import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, Ban, CheckCircle, UserRound, MapPin, Truck, Pencil, Euro } from "lucide-react";

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
import { ClientPricingRulesBlock } from "@/components/admin/ClientPricingRulesBlock";
import { ClientLogo } from "@/components/admin/ClientLogo";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";

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
  avatar_url: string | null;
  societe: string | null;
  type_client: string | null;
}


function AdminClients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [pricingClient, setPricingClient] = useState<ClientRow | null>(null);
  const [missions, setMissions] = useState<any[]>([]);

  useEffect(() => {
    if (!selected) { setMissions([]); return; }
    void supabase
      .from("missions")
      .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total")
      .eq("user_id", selected.user_id)
      .order("date_prise_en_charge", { ascending: false })
      .limit(50)
      .then(({ data }) => setMissions(data ?? []));
  }, [selected]);

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
      .select("user_id, prenom, nom, email, telephone, created_at, avatar_url, societe, type_client")
      .in("user_id", clientUserIds);

    const { data: missionsRaw } = await supabase
      .from("missions")
      .select("user_id")
      .in("user_id", clientUserIds);

    const countMap = new Map<string, number>();
    (missionsRaw ?? []).forEach((m) => {
      countMap.set(m.user_id, (countMap.get(m.user_id) ?? 0) + 1);
    });

    const rows: ClientRow[] = (profiles ?? []).map((p: any) => ({
      user_id: p.user_id,
      prenom: p.prenom ?? "",
      nom: p.nom ?? "",
      email: p.email,
      telephone: p.telephone,
      created_at: p.created_at,
      actif: actifMap.get(p.user_id) ?? true,
      missions_count: countMap.get(p.user_id) ?? 0,
      avatar_url: p.avatar_url ?? null,
      societe: p.societe ?? null,
      type_client: p.type_client ?? null,
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
      !(await confirmToast("Suspendre ce client ? Il ne pourra plus se connecter à son espace."))
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
              <TR key={c.user_id} className="cursor-pointer" onClick={() => setSelected(c)}>
                <TD>
                  <div className="flex items-center gap-2">
                    <ClientLogo
                      src={c.avatar_url}
                      name={c.societe || `${c.prenom} ${c.nom}`.trim()}
                      isCompany={!!c.societe || c.type_client === "b2b" || c.type_client === "flotte"}
                      kind={c.type_client === "flotte" ? "flotte" : c.type_client === "b2b" ? "b2b" : "particulier"}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-pro-text truncate">{c.prenom} {c.nom}</p>
                      {c.societe && <p className="text-pro-muted text-xs truncate">{c.societe}</p>}
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
                  <Badge tone={c.actif ? "success" : "danger"}>{c.actif ? "Actif" : "Suspendu"}</Badge>
                </TD>
                <TD onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPricingClient(c);
                      }}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-emerald-600 hover:bg-emerald-50"
                      title="Gérer les tarifs personnalisés (estimateur)"
                    >
                      <Euro size={15} />
                    </button>
                    <button
                      onClick={() => setSelected(c)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-pro-accent hover:bg-pro-accent/10"
                      title="Voir la fiche"
                    >
                      <Eye size={15} />
                    </button>
                    {c.actif ? (
                      <IconButton onClick={() => toggleActif(c.user_id, false)} title="Suspendre" tone="danger"><Ban size={15} /></IconButton>
                    ) : (
                      <IconButton onClick={() => toggleActif(c.user_id, true)} title="Réactiver" tone="success"><CheckCircle size={15} /></IconButton>
                    )}
                  </div>

                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {selected && (
        <AdminDetailDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={`${selected.prenom} ${selected.nom}`.trim() || "Client"}
          subtitle={selected.email ?? undefined}
          badge={<DrawerBadge tone={selected.actif ? "green" : "red"}>{selected.actif ? "Actif" : "Suspendu"}</DrawerBadge>}
          footer={
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const next = window.prompt("Nouvel email du client :", selected.email ?? "");
                  if (!next || next === selected.email) return;
                  const { data, error } = await supabase.functions.invoke("admin-user-actions", {
                    body: { action: "change_email", user_id: selected.user_id, email: next.trim() },
                  });
                  if (error || (data as any)?.error) {
                    toast.error(`Échec : ${(data as any)?.error ?? error?.message ?? "erreur inconnue"}`);
                    return;
                  }
                  setSelected({ ...selected, email: next.trim() });
                  await fetchClients();
                }}
              >
                <Pencil size={12} className="mr-1" /> Modifier l'email
              </Button>
              {selected.actif ? (
                <Button size="sm" variant="outline" onClick={async () => { await toggleActif(selected.user_id, false); setSelected({ ...selected, actif: false }); }}>
                  <Ban size={12} className="mr-1" /> Suspendre
                </Button>
              ) : (
                <Button size="sm" onClick={async () => { await toggleActif(selected.user_id, true); setSelected({ ...selected, actif: true }); }} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  <CheckCircle size={12} className="mr-1" /> Réactiver
                </Button>
              )}
            </div>
          }
        >
          <DrawerSection title="Coordonnées" icon={<UserRound size={12} />}>
            <DrawerGrid>
              <DrawerField label="Email" value={selected.email} />
              <DrawerField label="Téléphone" value={selected.telephone} />
              <DrawerField label="Inscrit le" value={new Date(selected.created_at).toLocaleDateString("fr-FR")} />
              <DrawerField label="Missions" value={String(selected.missions_count)} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title={`Historique missions (${missions.length})`} icon={<Truck size={12} />}>
            {missions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Aucune mission.</p>
            ) : (
              <div className="space-y-2">
                {missions.map((m) => (
                  <div key={m.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 flex items-center gap-2"><MapPin size={12} className="text-slate-500" />{m.ville_depart ?? "?"} → {m.ville_arrivee ?? "?"}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{m.numero ?? "—"} · {m.statut}</p>
                      {m.date_prise_en_charge && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 shrink-0 ml-3">{m.prix_total ? `${Number(m.prix_total).toLocaleString("fr-FR")} €` : "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>
        </AdminDetailDrawer>
      )}

      {pricingClient && (
        <AdminDetailDrawer
          open={!!pricingClient}
          onClose={() => setPricingClient(null)}
          title={`Tarifs estimateur — ${`${pricingClient.prenom} ${pricingClient.nom}`.trim() || "Client"}`}
          subtitle={pricingClient.email ?? undefined}
          badge={<DrawerBadge tone="green">Tarifs personnalisés</DrawerBadge>}
          width="2xl"
        >
          <div id="tarifs" className="scroll-mt-24">
            {pricingClient.email ? (
              <ClientPricingRulesBlock
                clientUserId={pricingClient.user_id}
                clientEmail={pricingClient.email}
              />
            ) : (
              <DrawerSection title="Tarifs personnalisés" icon={<Euro size={12} />}>
                <p className="text-sm text-slate-500">
                  Ajoutez d'abord un email au client pour pouvoir gérer ses tarifs personnalisés.
                </p>
              </DrawerSection>
            )}
          </div>
        </AdminDetailDrawer>
      )}

    </div>
  );
}
