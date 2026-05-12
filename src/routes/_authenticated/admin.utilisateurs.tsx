import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Search, Users, Shield, IdCard, Building2, UserRound,
  MoreHorizontal, KeyRound, Ban, CheckCircle2, Trash2, UserCog, FileText, Receipt,
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
  created_at: string;
  source: "profile" | "convoyeur";
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
        .select("user_id, email, nom, prenom, telephone, type_client, account_status, organization_id, societe, created_at")
        .order("created_at", { ascending: false });

      const { data: convoyeurs } = await supabase
        .from("convoyeurs")
        .select("user_id, email, nom, prenom, telephone, account_status, organization_id, statut, created_at");

      const { data: roles } = await supabase.from("user_roles").select("user_id, role").eq("actif", true);
      const roleByUser = new Map<string, string>();
      (roles ?? []).forEach((r) => roleByUser.set(r.user_id, r.role));

      const rows: UnifiedUser[] = [];
      (profiles ?? []).forEach((p) => {
        const role = roleByUser.get(p.user_id) ?? p.type_client ?? "client";
        rows.push({
          user_id: p.user_id, email: p.email, nom: p.nom, prenom: p.prenom, telephone: p.telephone,
          role, type_client: p.type_client, account_status: p.account_status ?? "active",
          organization_id: p.organization_id, societe: p.societe, created_at: p.created_at, source: "profile",
        });
      });
      (convoyeurs ?? []).forEach((c) => {
        if (rows.some((r) => r.user_id === c.user_id)) return;
        rows.push({
          user_id: c.user_id, email: c.email, nom: c.nom, prenom: c.prenom, telephone: c.telephone,
          role: "convoyeur", type_client: null, account_status: c.account_status ?? "active",
          organization_id: c.organization_id, societe: null, created_at: c.created_at, source: "convoyeur",
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
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-pro-accent/10 flex items-center justify-center">
            <Users className="text-pro-accent" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-pro-text">Utilisateurs</h1>
            <p className="text-sm text-pro-muted">Contrôle total : voir, modifier, suspendre, supprimer.</p>
          </div>
        </div>
        <CreateAccountDialog onCreated={() => void loadUsers()} />
      </header>

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
                      <div className="font-medium text-pro-text">{u.prenom} {u.nom}</div>
                      <div className="text-xs text-pro-muted">{u.email ?? "—"}</div>
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

  useEffect(() => {
    if (!user) { setDevis([]); setFactures([]); setLogs([]); return; }
    (async () => {
      if (user.email) {
        const [{ data: d }, { data: f }] = await Promise.all([
          supabase.from("devis").select("id, numero, statut, prix_estime, created_at").eq("email", user.email).order("created_at", { ascending: false }).limit(20),
          supabase.from("factures").select("id, numero, statut, prix_ttc, created_at").eq("client_email", user.email).order("created_at", { ascending: false }).limit(20),
        ]);
        setDevis(d ?? []); setFactures(f ?? []);
      }
      const { data: l } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, created_at, metadata")
        .eq("entity_id", user.user_id)
        .order("created_at", { ascending: false })
        .limit(30);
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

  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{user.prenom} {user.nom}</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>

        {/* Actions rapides */}
        <div className="flex flex-wrap gap-2 mt-4">
          {suspended ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => callAction({ action: "reactivate", user_id: user.user_id })}>
              <CheckCircle2 size={14} className="mr-1" /> Réactiver
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => callAction({ action: "suspend", user_id: user.user_id })}>
              <Ban size={14} className="mr-1" /> Suspendre
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => callAction({ action: "reset_password", user_id: user.user_id })}>
            <KeyRound size={14} className="mr-1" /> Reset mot de passe
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={busy}><UserCog size={14} className="mr-1" /> Rôle</Button>
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
              <Button size="sm" variant="outline" disabled={busy}><Building2 size={14} className="mr-1" /> Type</Button>
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
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} className="mr-1" /> Supprimer
          </Button>
        </div>

        <Tabs defaultValue="profil" className="mt-6">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="profil">Profil</TabsTrigger>
            <TabsTrigger value="devis">Devis ({devis.length})</TabsTrigger>
            <TabsTrigger value="factures">Factures ({factures.length})</TabsTrigger>
            <TabsTrigger value="logs">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="profil" className="space-y-3 mt-4">
            <Field label="ID utilisateur" value={user.user_id} mono />
            <Field label="Téléphone" value={user.telephone || "—"} />
            <Field label="Société" value={user.societe || "—"} />
            <Field label="Rôle" value={roleLabels[user.role]?.label ?? user.role} />
            <Field label="Type client" value={user.type_client ?? "—"} />
            <Field label="Statut" value={user.account_status} />
            <Field label="Créé le" value={new Date(user.created_at).toLocaleString("fr-FR")} />
          </TabsContent>

          <TabsContent value="devis" className="mt-4 space-y-2">
            {devis.length === 0 ? (
              <p className="text-sm text-pro-muted text-center py-8">Aucun devis lié.</p>
            ) : devis.map((d) => (
              <div key={d.id} className="border border-pro-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-pro-text flex items-center gap-2"><FileText size={14} />{d.numero}</p>
                  <p className="text-xs text-pro-muted">{new Date(d.created_at).toLocaleDateString("fr-FR")} · {d.statut}</p>
                </div>
                <p className="text-sm font-semibold">{Number(d.prix_estime).toFixed(2)} €</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="factures" className="mt-4 space-y-2">
            {factures.length === 0 ? (
              <p className="text-sm text-pro-muted text-center py-8">Aucune facture liée.</p>
            ) : factures.map((f) => (
              <div key={f.id} className="border border-pro-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-pro-text flex items-center gap-2"><Receipt size={14} />{f.numero}</p>
                  <p className="text-xs text-pro-muted">{new Date(f.created_at).toLocaleDateString("fr-FR")} · {f.statut}</p>
                </div>
                <p className="text-sm font-semibold">{Number(f.prix_ttc).toFixed(2)} €</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="logs" className="mt-4 space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-pro-muted text-center py-8">Aucune activité enregistrée.</p>
            ) : logs.map((l) => (
              <div key={l.id} className="border border-pro-border rounded-lg p-3">
                <p className="text-sm font-medium text-pro-text">{l.action}</p>
                <p className="text-xs text-pro-muted">{new Date(l.created_at).toLocaleString("fr-FR")} · {l.entity_type}</p>
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
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-pro-border pb-2">
      <span className="text-xs uppercase tracking-wider text-pro-muted">{label}</span>
      <span className={`text-sm text-pro-text ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
