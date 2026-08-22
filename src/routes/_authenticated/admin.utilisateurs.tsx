import { createFileRoute } from "@tanstack/react-router";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Search, Users, Shield, IdCard, Building2, UserRound,
  MoreHorizontal, KeyRound, Ban, CheckCircle2, Trash2, UserCog, FileText, Receipt, MessageSquare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreateAccountDialog } from "@/components/admin/CreateAccountDialog";
import { toast } from "sonner";
import { getHighestActiveRole } from "@/lib/roles";
import { ClientLogo } from "@/components/admin/ClientLogo";
import { UserMessagesPanel, useUserMessagesCount } from "@/components/admin/UserMessagesPanel";

export const Route = createFileRoute("/_authenticated/admin/utilisateurs")({
  component: AdminUtilisateurs,
});

type UnifiedUser = {
  user_id: string;
  email: string | null;
  nom: string;
  prenom: string;
  telephone: string | null;
  role: string;
  type_client: string | null;
  account_status: string;
  organization_id: string | null;
  societe: string | null;
  siret: string | null;
  adresse: string | null;
  created_at: string;
  source: "profile" | "convoyeur";
  avatar_url: string | null;
  logo_url: string | null;
  convoyeur_statut: string | null;
};

const roleLabels: Record<string, { label: string; tone: string; icon: typeof Shield }> = {
  super_admin: { label: "Super admin", tone: "bg-purple-100 text-purple-700 border-purple-200", icon: Shield },
  admin: { label: "Admin", tone: "bg-blue-100 text-blue-700 border-blue-200", icon: Shield },
  manager: { label: "Manager", tone: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: Shield },
  convoyeur: { label: "Convoyeur", tone: "bg-amber-100 text-amber-700 border-amber-200", icon: IdCard },
  sous_traitant: { label: "Sous-traitant", tone: "bg-orange-100 text-orange-700 border-orange-200", icon: IdCard },
  client: { label: "Client", tone: "bg-slate-100 text-slate-700 border-slate-200", icon: UserRound },
};

const statusTone: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  suspended: "bg-red-100 text-red-700 border-red-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};

function AdminUtilisateurs() {
  const [users, setUsers] = useState<UnifiedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<UnifiedUser | null>(null);

  useEffect(() => { void loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, nom, prenom, telephone, type_client, account_status, organization_id, societe, siret, adresse, created_at, avatar_url, logo_url")
        .order("created_at", { ascending: false });

      const { data: convoyeurs } = await supabase
        .from("convoyeurs")
        .select("user_id, email, nom, prenom, telephone, account_status, organization_id, statut, ville, created_at");

      const { data: roles } = await supabase.from("user_roles").select("user_id, role, actif").eq("actif", true);
      const roleByUser = new Map<string, string>();
      const groupedRoles = new Map<string, Array<{ role: string | null; actif?: boolean | null }>>();
      (roles ?? []).forEach((r) => {
        const existing = groupedRoles.get(r.user_id) ?? [];
        existing.push({ role: r.role, actif: r.actif });
        groupedRoles.set(r.user_id, existing);
      });
      groupedRoles.forEach((entries, userId) => {
        const resolvedRole = getHighestActiveRole(entries);
        if (resolvedRole) roleByUser.set(userId, resolvedRole);
      });

      const rows: UnifiedUser[] = [];
      const convoyeurByUser = new Map<string, any>();
      (convoyeurs ?? []).forEach((c: any) => convoyeurByUser.set(c.user_id, c));
      (profiles ?? []).forEach((p: any) => {
        const conv = convoyeurByUser.get(p.user_id);
        const role = roleByUser.get(p.user_id) ?? (conv ? "convoyeur" : p.type_client ?? "client");
        rows.push({
          user_id: p.user_id, email: p.email, nom: p.nom, prenom: p.prenom, telephone: p.telephone,
          role, type_client: p.type_client, account_status: p.account_status ?? "active",
          organization_id: p.organization_id, societe: p.societe, siret: p.siret ?? null,
          adresse: p.adresse ?? null, created_at: p.created_at, source: "profile",
          avatar_url: p.avatar_url ?? null, logo_url: p.logo_url ?? null, convoyeur_statut: conv?.statut ?? null,
        });
      });
      (convoyeurs ?? []).forEach((c: any) => {
        if (rows.some((r) => r.user_id === c.user_id)) return;
        rows.push({
          user_id: c.user_id, email: c.email, nom: c.nom, prenom: c.prenom, telephone: c.telephone,
          role: "convoyeur", type_client: null, account_status: c.account_status ?? "active",
          organization_id: c.organization_id, societe: null, siret: null, adresse: c.ville ?? null,
          created_at: c.created_at, source: "convoyeur",
          avatar_url: null, logo_url: null, convoyeur_statut: c.statut ?? null,
        });
      });
      setUsers(rows);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.account_status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.email?.toLowerCase().includes(q) ||
        u.nom.toLowerCase().includes(q) ||
        u.prenom.toLowerCase().includes(q) ||
        (u.societe ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const counts = useMemo(() => ({
    total: users.length,
    admins: users.filter((u) => u.role === "admin" || u.role === "super_admin").length,
    convoyeurs: users.filter((u) => u.role === "convoyeur").length,
    b2b: users.filter((u) => u.type_client === "b2b").length,
    particuliers: users.filter((u) => u.type_client === "particulier").length,
  }), [users]);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        breadcrumb="Utilisateurs"
        eyebrow="Comptes & accès"
        title="Utilisateurs"
        subtitle="Contrôle total : voir, modifier, suspendre, supprimer."
        actions={<CreateAccountDialog onCreated={() => void loadUsers()} />}
      />


      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total" value={counts.total} icon={Users} />
        <KpiCard label="Admins" value={counts.admins} icon={Shield} />
        <KpiCard label="Convoyeurs" value={counts.convoyeurs} icon={IdCard} />
        <KpiCard label="B2B" value={counts.b2b} icon={Building2} />
        <KpiCard label="Particuliers" value={counts.particuliers} icon={UserRound} />
      </div>

      <div className="bg-white border border-pro-border rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" size={16} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (email, nom, société)…" className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Rôle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="super_admin">Super admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="convoyeur">Convoyeur</SelectItem>
            <SelectItem value="sous_traitant">Sous-traitant</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="suspended">Suspendu</SelectItem>
            <SelectItem value="archived">Archivé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-pro-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={24} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-pro-muted text-sm">Aucun utilisateur trouvé.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Société</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const r = roleLabels[u.role] ?? roleLabels.client;
                const Icon = r.icon;
                return (
                  <TableRow
                    key={`${u.user_id}-${u.source}`}
                    className="cursor-pointer hover:bg-pro-bg-soft"
                    onClick={() => setSelected(u)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ClientLogo
                          src={u.logo_url || u.avatar_url}
                          name={u.societe || `${u.prenom} ${u.nom}`.trim() || u.email || "?"}
                          isCompany={!!u.societe || u.type_client === "b2b" || u.type_client === "flotte"}
                          kind={
                            u.role === "admin" || u.role === "super_admin"
                              ? "admin"
                              : u.role === "convoyeur"
                                ? "convoyeur"
                                : u.type_client === "flotte"
                                  ? "flotte"
                                  : u.type_client === "b2b"
                                    ? "b2b"
                                    : "particulier"
                          }
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-pro-text truncate">{u.prenom} {u.nom}</div>
                          <div className="text-xs text-pro-muted truncate">{u.email ?? "—"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${r.tone}`}>
                        <Icon size={12} />{r.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-pro-text-soft">
                      {u.type_client === "b2b" ? "B2B" : u.type_client === "particulier" ? "Particulier" : u.type_client === "flotte" ? "Flotte" : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-pro-text-soft">{u.societe || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusTone[u.account_status] ?? statusTone.active}>{u.account_status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-pro-muted">{new Date(u.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => setSelected(u)}>
                        <MoreHorizontal size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <UserDetailDrawer
        user={selected}
        onClose={() => setSelected(null)}
        onChanged={() => { void loadUsers(); }}
      />
    </div>
  );
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Shield }) {
  return (
    <div className="bg-white border border-pro-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-pro-muted">{label}</p>
        <Icon size={16} className="text-pro-muted" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-pro-text">{value}</p>
    </div>
  );
}

/* -------------------- Drawer détail utilisateur -------------------- */

function UserDetailDrawer({
  user, onClose, onChanged,
}: { user: UnifiedUser | null; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [devis, setDevis] = useState<any[]>([]);
  const [factures, setFactures] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const { count: msgCount, refresh: refreshMsgCount } = useUserMessagesCount(user?.user_id ?? null);


  const [missions, setMissions] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);

  useEffect(() => {
    if (!user) { setDevis([]); setFactures([]); setLogs([]); setMissions([]); setPaiements([]); return; }
    (async () => {
      const email = (user.email ?? "").trim();
      const emailLower = email.toLowerCase();
      const uid = user.user_id;

      // Helper: ilike + user_id fallback
      const orEmailUid = (emailCol: string) =>
        email
          ? `${emailCol}.ilike.${emailLower},user_id.eq.${uid}`
          : `user_id.eq.${uid}`;

      const [{ data: d }, { data: f }, { data: m }, { data: b2b }] = await Promise.all([
        supabase
          .from("devis")
          .select("id, numero, statut, prix_estime, created_at, paid_at, amount_paid_cents, depart, arrivee")
          .or(orEmailUid("email"))
          .order("created_at", { ascending: false })
          .limit(100),
        email
          ? supabase
              .from("factures")
              .select("id, numero, statut, prix_ttc, created_at, date_paiement, depart, arrivee")
              .ilike("client_email", emailLower)
              .order("created_at", { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("demandes_convoyage")
          .select("id, depart, arrivee, statut, prix_estime, paid_at, amount_paid_cents, created_at")
          .or(orEmailUid("email"))
          .order("created_at", { ascending: false })
          .limit(100),
        email
          ? supabase
              .from("b2b_transport_requests")
              .select("id, numero, pickup_address, dropoff_address, payment_status, estimated_price_ttc, created_at, operational_status, company_id")
              .order("created_at", { ascending: false })
              .limit(100)
              .then(async (res) => {
                // filter by company contact email match
                const ids = (res.data ?? []).map((r: any) => r.company_id).filter(Boolean);
                if (ids.length === 0) return { data: [] as any[] };
                const { data: cs } = await supabase
                  .from("companies")
                  .select("id, contact_email")
                  .in("id", ids);
                const ok = new Set(
                  (cs ?? [])
                    .filter((c: any) => (c.contact_email ?? "").toLowerCase() === emailLower)
                    .map((c: any) => c.id),
                );
                return { data: (res.data ?? []).filter((r: any) => ok.has(r.company_id)) };
              })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      setDevis(d ?? []);
      setFactures(f ?? []);
      // Combine demandes + b2b requests under "missions"
      const b2bAsMissions = (b2b ?? []).map((r: any) => ({
        id: r.id,
        depart: r.pickup_address,
        arrivee: r.dropoff_address,
        statut: r.operational_status,
        prix_estime: r.estimated_price_ttc,
        paid_at: r.payment_status === "paid" ? r.created_at : null,
        created_at: r.created_at,
        source: "B2B",
      }));
      setMissions([...(m ?? []), ...b2bAsMissions]);

      // Paiements multi-source
      const paiementsList: any[] = [];
      (d ?? []).forEach((x: any) => {
        if (x.paid_at) paiementsList.push({
          id: `dev-${x.id}`, source: "Devis", numero: x.numero,
          montant: (x.amount_paid_cents ?? Number(x.prix_estime) * 100) / 100, date: x.paid_at,
        });
      });
      (m ?? []).forEach((x: any) => {
        if (x.paid_at) paiementsList.push({
          id: `dem-${x.id}`, source: "Demande", numero: x.id.slice(0, 8),
          montant: (x.amount_paid_cents ?? Number(x.prix_estime ?? 0) * 100) / 100, date: x.paid_at,
        });
      });
      (f ?? []).filter((x: any) => x.date_paiement).forEach((x: any) => {
        paiementsList.push({
          id: `fac-${x.id}`, source: "Facture", numero: x.numero,
          montant: Number(x.prix_ttc ?? 0), date: x.date_paiement,
        });
      });
      (b2b ?? []).filter((x: any) => x.payment_status === "paid").forEach((x: any) => {
        paiementsList.push({
          id: `b2b-${x.id}`, source: "B2B", numero: x.numero,
          montant: Number(x.estimated_price_ttc ?? 0), date: x.created_at,
        });
      });
      paiementsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPaiements(paiementsList);

      // Logs : actor OR entity = user
      const { data: l } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, created_at, metadata")
        .or(`actor_user_id.eq.${uid},entity_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(50);
      setLogs(l ?? []);
    })();
  }, [user]);

  if (!user) return null;

  async function callAction(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-actions", { body: payload });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error ?? error?.message ?? "Action échouée");
      } else {
        toast.success("Action effectuée");
        onChanged();
      }
    } finally { setBusy(false); }
  }

  const suspended = user.account_status === "suspended";
  const roleMeta = roleLabels[user.role] ?? roleLabels.client;

  return (
    <AdminDetailDrawer
      open={!!user}
      onClose={onClose}
      title={`${user.prenom} ${user.nom}`.trim() || "Utilisateur"}
      subtitle={user.email ?? "—"}
      badge={
        <div className="flex flex-wrap gap-2">
          <DrawerBadge tone="blue">{roleMeta.label}</DrawerBadge>
          <DrawerBadge tone={suspended ? "red" : "green"}>{user.account_status}</DrawerBadge>
          {user.type_client && <DrawerBadge tone="slate">{user.type_client}</DrawerBadge>}
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {suspended ? (
            <Button size="sm" disabled={busy} onClick={() => callAction({ action: "reactivate", user_id: user.user_id })} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <CheckCircle2 size={14} className="mr-1" /> Réactiver
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => callAction({ action: "suspend", user_id: user.user_id })} className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-red-600 hover:border-red-300">
              <Ban size={14} className="mr-1" /> Suspendre
            </Button>
          )}
          <Button size="sm" disabled={busy} onClick={() => callAction({ action: "activate_role", user_id: user.user_id, role: user.role })} className="bg-[color:var(--admin-accent,#2563eb)] hover:bg-[color:var(--admin-accent,#2563eb)]/90 text-white shadow-sm" title="Réactive le rôle métier du compte sans activer les anciens rôles inactifs">
            <CheckCircle2 size={14} className="mr-1" /> Activer le rôle
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => callAction({ action: "reset_password", user_id: user.user_id })} className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
            <KeyRound size={14} className="mr-1" /> Reset MDP
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={busy} className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><UserCog size={14} className="mr-1" /> Rôle</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Changer le rôle</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["super_admin","admin","manager","convoyeur","sous_traitant","client"] as const).map((r) => (
                <DropdownMenuItem key={r} onClick={() => callAction({ action: "change_role", user_id: user.user_id, role: r })}>
                  {roleLabels[r].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={busy} className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><Building2 size={14} className="mr-1" /> Type</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Type de client</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["particulier","b2b","flotte"] as const).map((t) => (
                <DropdownMenuItem key={t} onClick={() => callAction({ action: "change_type_client", user_id: user.user_id, type_client: t })}>
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)} className="ml-auto bg-red-600 hover:bg-red-700 text-white shadow-sm">
            <Trash2 size={14} className="mr-1" /> Supprimer
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="profil" className="w-full">
        <TabsList className="grid grid-cols-6 w-full bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="profil" className="data-[state=active]:bg-white data-[state=active]:text-[color:var(--admin-accent,#2563eb)] data-[state=active]:shadow-sm text-slate-600 font-medium">Profil</TabsTrigger>
          <TabsTrigger value="devis" className="data-[state=active]:bg-white data-[state=active]:text-[color:var(--admin-accent,#2563eb)] data-[state=active]:shadow-sm text-slate-600 font-medium">Devis ({devis.length})</TabsTrigger>
          <TabsTrigger value="missions" className="data-[state=active]:bg-white data-[state=active]:text-[color:var(--admin-accent,#2563eb)] data-[state=active]:shadow-sm text-slate-600 font-medium">Missions ({missions.length})</TabsTrigger>
          <TabsTrigger value="factures" className="data-[state=active]:bg-white data-[state=active]:text-[color:var(--admin-accent,#2563eb)] data-[state=active]:shadow-sm text-slate-600 font-medium">Factures ({factures.length})</TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm text-slate-600 font-medium">
            <MessageSquare
              size={14}
              className={msgCount > 0 ? "text-[#6effcd] drop-shadow-[0_0_6px_rgba(110,255,205,0.9)]" : "text-slate-400"}
            />
            <span className={msgCount > 0 ? "text-[#0f8f6c]" : ""}>Messages</span>
            {msgCount > 0 && (
              <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#6effcd] px-1.5 text-[10px] font-bold text-[#04231a] shadow-[0_0_10px_rgba(110,255,205,0.8)]">
                {msgCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-white data-[state=active]:text-[color:var(--admin-accent,#2563eb)] data-[state=active]:shadow-sm text-slate-600 font-medium">Logs</TabsTrigger>
        </TabsList>



        <TabsContent value="profil" className="mt-4 space-y-4">
          <DrawerSection title="Identité" icon={<UserRound size={12} />}>
            <DrawerGrid>
              <DrawerField label="Prénom" value={user.prenom} />
              <DrawerField label="Nom" value={user.nom} />
              <DrawerField label="Email" value={user.email} />
              <DrawerField label="Téléphone" value={user.telephone} />
              <DrawerField label="Adresse" value={user.adresse} />
              <DrawerField label="Créé le" value={new Date(user.created_at).toLocaleString("fr-FR")} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title="Compte" icon={<Shield size={12} />}>
            <DrawerGrid>
              <DrawerField label="ID utilisateur" value={user.user_id} mono />
              <DrawerField label="Rôle" value={roleMeta.label} />
              <DrawerField label="Type" value={user.type_client ?? "—"} />
              <DrawerField label="Statut" value={user.account_status} />
            </DrawerGrid>
          </DrawerSection>

          {(user.societe || user.siret) && (
            <DrawerSection title="Entreprise" icon={<Building2 size={12} />}>
              <DrawerGrid>
                <DrawerField label="Société" value={user.societe} />
                <DrawerField label="SIRET" value={user.siret} mono />
                <DrawerField label="Organisation" value={user.organization_id} mono />
              </DrawerGrid>
            </DrawerSection>
          )}

          {paiements.length > 0 && (
            <DrawerSection title={`Paiements (${paiements.length})`} icon={<Receipt size={12} />}>
              <div className="space-y-2">
                {paiements.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-white/90">{p.source} · {p.numero}</p>
                      <p className="text-xs text-white/50">{new Date(p.date).toLocaleString("fr-FR")}</p>
                    </div>
                    <p className="font-semibold text-emerald-300">{p.montant.toFixed(2)} €</p>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}
        </TabsContent>

        <TabsContent value="devis" className="mt-4 space-y-2">
          {devis.length === 0 ? (
            <p className="text-sm text-white/50 text-center py-8">Aucun devis lié.</p>
          ) : devis.map((d) => (
            <div key={d.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-2"><FileText size={14} />{d.numero}</p>
                <p className="text-xs text-white/50">{new Date(d.created_at).toLocaleDateString("fr-FR")} · {d.statut}</p>
              </div>
              <p className="text-sm font-semibold text-white">{Number(d.prix_estime).toFixed(2)} €</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="missions" className="mt-4 space-y-2">
          {missions.length === 0 ? (
            <p className="text-sm text-white/50 text-center py-8">Aucune mission liée.</p>
          ) : missions.map((m) => (
            <div key={m.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="text-sm font-medium text-white">{m.depart} → {m.arrivee}</p>
              <p className="text-xs text-white/50">{new Date(m.created_at).toLocaleDateString("fr-FR")} · {m.statut}{m.prix_estime ? ` · ${Number(m.prix_estime).toFixed(2)} €` : ""}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="factures" className="mt-4 space-y-2">
          {factures.length === 0 ? (
            <p className="text-sm text-white/50 text-center py-8">Aucune facture liée.</p>
          ) : factures.map((f) => (
            <div key={f.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-2"><Receipt size={14} />{f.numero}</p>
                <p className="text-xs text-white/50">{new Date(f.created_at).toLocaleDateString("fr-FR")} · {f.statut}</p>
              </div>
              <p className="text-sm font-semibold text-white">{Number(f.prix_ttc).toFixed(2)} €</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <UserMessagesPanel
            target={{
              userId: user.user_id,
              email: user.email,
              prenom: (user as any).prenom ?? null,
              label: `${(user as any).prenom ?? ""} ${(user as any).nom ?? ""}`.trim() || user.email || undefined,
              role: (user as any).role === "convoyeur" ? "convoyeur" : "client",
            }}
            onSent={refreshMsgCount}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-2">

          {logs.length === 0 ? (
            <p className="text-sm text-white/50 text-center py-8">Aucune activité enregistrée.</p>
          ) : logs.map((l) => (
            <div key={l.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="text-sm font-medium text-white">{l.action}</p>
              <p className="text-xs text-white/50">{new Date(l.created_at).toLocaleString("fr-FR")} · {l.entity_type}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ce compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées (devis, missions, documents) resteront mais le compte sera supprimé de l'authentification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { setConfirmDelete(false); await callAction({ action: "delete", user_id: user.user_id }); onClose(); }}
              className="bg-red-600 hover:bg-red-700"
            >Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminDetailDrawer>
  );
}

