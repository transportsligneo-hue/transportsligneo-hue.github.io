import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, Ban, CheckCircle, UserRound, MapPin, Truck, Pencil, Euro, Search, Phone, Mail } from "lucide-react";

import {
  EmptyState,
  IconButton,
} from "@/components/admin/AdminUI";
import { getHighestActiveRole } from "@/lib/roles";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import { Button } from "@/components/ui/button";
import { ClientPricingRulesBlock } from "@/components/admin/ClientPricingRulesBlock";
import { ClientLogo } from "@/components/admin/ClientLogo";
import { LogoLoader } from "@/components/brand/LogoLoader";
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
  org_logo_url: string | null;
  org_name: string | null;
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
      .select("user_id, prenom, nom, email, telephone, created_at, avatar_url, logo_url, societe, type_client, organization_id")
      .in("user_id", clientUserIds);

    // Rattachement organisation : via profiles.organization_id ou via organization_members
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("user_id, organization_id")
      .in("user_id", clientUserIds);

    const orgByUser = new Map<string, string>();
    (memberships ?? []).forEach((m: any) => {
      if (m.organization_id) orgByUser.set(m.user_id, m.organization_id);
    });
    (profiles ?? []).forEach((p: any) => {
      if (p.organization_id) orgByUser.set(p.user_id, p.organization_id);
    });

    const orgIds = Array.from(new Set(Array.from(orgByUser.values())));
    const orgMap = new Map<string, { logo_url: string | null; name: string | null }>();
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, logo_url, legal_name, commercial_name")
        .in("id", orgIds);
      (orgs ?? []).forEach((o: any) => {
        orgMap.set(o.id, { logo_url: o.logo_url ?? null, name: o.commercial_name || o.legal_name || null });
      });
    }

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
      avatar_url: p.avatar_url ?? p.logo_url ?? null,
      societe: p.societe ?? null,
      type_client: p.type_client ?? null,
      org_logo_url: orgMap.get(orgByUser.get(p.user_id) ?? "")?.logo_url ?? null,
      org_name: orgMap.get(orgByUser.get(p.user_id) ?? "")?.name ?? null,
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

  const actifsCount = clients.filter((c) => c.actif).length;
  const suspendusCount = clients.filter((c) => !c.actif).length;
  const totalMissions = clients.reduce((s, c) => s + c.missions_count, 0);

  return (
    <div>
      {/* ===== En-tête ===== */}
      <div className="dvx-head">
        <div className="min-w-0">
          <h1 className="dvx-title">Clients</h1>
          <p className="dvx-sub">
            {clients.length} client{clients.length > 1 ? "s" : ""} inscrit{clients.length > 1 ? "s" : ""}.
          </p>
        </div>
        <button type="button" className="dvx-cta" onClick={fetchClients}>
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      {/* ===== Statistiques ===== */}
      <div className="dvx-stats">
        <div className="dvx-stat">
          <span className="dvx-stat-ic blue"><UserRound size={17} /></span>
          <p className="dvx-stat-k">Total</p>
          <p className="dvx-stat-v">{clients.length}</p>
          <p className="dvx-stat-t dim">Clients inscrits</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic green"><CheckCircle size={17} /></span>
          <p className="dvx-stat-k">Actifs</p>
          <p className="dvx-stat-v">{actifsCount}</p>
          <p className={`dvx-stat-t ${actifsCount > 0 ? "up" : "warn"}`}>Comptes en service</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic red"><Ban size={17} /></span>
          <p className="dvx-stat-k">Suspendus</p>
          <p className="dvx-stat-v">{suspendusCount}</p>
          <p className={`dvx-stat-t ${suspendusCount > 0 ? "warn" : "dim"}`}>
            {suspendusCount > 0 ? "À examiner" : "Aucun compte suspendu"}
          </p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic violet"><Truck size={17} /></span>
          <p className="dvx-stat-k">Missions</p>
          <p className="dvx-stat-v">{totalMissions}</p>
          <p className="dvx-stat-t dim">Total réalisées / en cours</p>
        </div>
      </div>

      {/* ===== Barre de filtres unifiée ===== */}
      <div className="dvx-filters">
        <div className="dvx-search">
          <Search size={15} />
          <input
            className="dvx-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client, un email, un téléphone…"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LogoLoader label="Chargement des clients…" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={search ? "Aucun résultat" : "Aucun client"}
          description={search ? "Essayez une autre recherche." : "Les clients inscrits apparaîtront ici."}
        />
      ) : (
        <div className="space-y-3.5">
          {filtered.map((c) => {
            const isCompany = !!c.societe || !!c.org_name || c.type_client === "b2b" || c.type_client === "flotte";
            const name = `${c.prenom} ${c.nom}`.trim() || "—";
            const initials = `${(c.prenom || "").charAt(0)}${(c.nom || "").charAt(0)}`.toUpperCase() || "?";
            return (
              <div key={c.user_id} className={`dvx-card ${!c.actif ? "is-archived" : ""}`}>
                {/* En-tête de carte */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className={`dvx-badge ${c.actif ? "green" : "red"}`}>{c.actif ? "Actif" : "Suspendu"}</span>
                    {c.societe && <span className="dvx-badge blue">{c.societe}</span>}
                    <span className="text-[11.5px] text-[#a3a4ac]">
                      Inscrit le {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>

                {/* Corps */}
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <ClientLogo
                      src={c.avatar_url || c.org_logo_url}
                      name={c.org_name || c.societe || name}
                      isCompany={isCompany}
                      kind={c.org_logo_url || c.type_client === "flotte" ? "flotte" : c.type_client === "b2b" ? "b2b" : "particulier"}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-[#14161c] truncate">{name}</p>
                      {c.societe && <p className="mt-1 text-[11.5px] text-[#70727d] truncate">{c.societe}</p>}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="dvx-col-k">Contact</p>
                    {c.email && (
                      <p className="text-[12.5px] text-[#14161c] flex items-center gap-1.5 truncate"><Mail size={12} className="text-[#a3a4ac] shrink-0" />{c.email}</p>
                    )}
                    {c.telephone && (
                      <p className="mt-1.5 text-[12.5px] text-[#14161c] flex items-center gap-1.5"><Phone size={12} className="text-[#a3a4ac] shrink-0" />{c.telephone}</p>
                    )}
                    {!c.email && !c.telephone && <p className="text-[12.5px] text-[#a3a4ac]">—</p>}
                  </div>

                  <div className="min-w-0">
                    <p className="dvx-col-k">Missions</p>
                    <p className="text-[13.5px] font-bold text-[#14161c]">{c.missions_count}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="dvx-col-k">Type de compte</p>
                    <p className="text-[12.5px] text-[#14161c]">
                      {c.type_client === "flotte" ? "Flotte partenaire" : c.type_client === "b2b" ? "B2B" : "Particulier"}
                    </p>
                  </div>
                </div>

                {/* Pied de carte */}
                <div className="dvx-foot">
                  <button
                    type="button"
                    className="dvx-ico"
                    title="Gérer les tarifs personnalisés (estimateur)"
                    onClick={() => setPricingClient(c)}
                  >
                    <Euro size={15} />
                  </button>
                  <button type="button" className="dvx-ico" title="Voir la fiche" onClick={() => setSelected(c)}>
                    <Eye size={15} />
                  </button>
                  {c.actif ? (
                    <button type="button" className="dvx-btn" onClick={() => toggleActif(c.user_id, false)}>
                      <Ban size={13} />
                      Suspendre
                    </button>
                  ) : (
                    <button type="button" className="dvx-btn solid" onClick={() => toggleActif(c.user_id, true)}>
                      <CheckCircle size={13} />
                      Réactiver
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
