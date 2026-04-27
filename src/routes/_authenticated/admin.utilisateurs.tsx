import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Users, Shield, IdCard, Building2, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      // 1. Profiles (clients particuliers + B2B + admins)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, nom, prenom, telephone, type_client, account_status, organization_id, societe, created_at")
        .order("created_at", { ascending: false });

      // 2. Convoyeurs
      const { data: convoyeurs } = await supabase
        .from("convoyeurs")
        .select("user_id, email, nom, prenom, telephone, account_status, organization_id, statut, created_at, type_convoyeur");

      // 3. Roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleByUser = new Map<string, string>();
      (roles ?? []).forEach((r) => roleByUser.set(r.user_id, r.role));

      const rows: UnifiedUser[] = [];

      (profiles ?? []).forEach((p) => {
        const role = roleByUser.get(p.user_id) ?? p.type_client ?? "client";
        rows.push({
          user_id: p.user_id,
          email: p.email,
          nom: p.nom,
          prenom: p.prenom,
          telephone: p.telephone,
          role,
          type_client: p.type_client,
          account_status: p.account_status ?? "active",
          organization_id: p.organization_id,
          societe: p.societe,
          created_at: p.created_at,
          source: "profile",
        });
      });

      (convoyeurs ?? []).forEach((c) => {
        // Évite doublon si profile déjà ajouté
        if (rows.some((r) => r.user_id === c.user_id && r.role === "convoyeur")) return;
        rows.push({
          user_id: c.user_id,
          email: c.email,
          nom: c.nom,
          prenom: c.prenom,
          telephone: c.telephone,
          role: "convoyeur",
          type_client: null,
          account_status: c.account_status ?? "active",
          organization_id: c.organization_id,
          societe: null,
          created_at: c.created_at,
          source: "convoyeur",
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

  const counts = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role === "admin" || u.role === "super_admin").length,
      convoyeurs: users.filter((u) => u.role === "convoyeur").length,
      b2b: users.filter((u) => u.type_client === "b2b").length,
      particuliers: users.filter((u) => u.type_client === "particulier").length,
    };
  }, [users]);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-pro-accent/10 flex items-center justify-center">
            <Users className="text-pro-accent" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-pro-text">Utilisateurs &amp; comptes</h1>
            <p className="text-sm text-pro-muted">Vue centralisée de tous les comptes de la plateforme.</p>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total" value={counts.total} icon={Users} />
        <KpiCard label="Admins" value={counts.admins} icon={Shield} />
        <KpiCard label="Convoyeurs" value={counts.convoyeurs} icon={IdCard} />
        <KpiCard label="Clients B2B" value={counts.b2b} icon={Building2} />
        <KpiCard label="Particuliers" value={counts.particuliers} icon={UserRound} />
      </div>

      {/* Filters */}
      <div className="bg-white border border-pro-border rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (email, nom, société)…"
            className="pl-9"
          />
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

      {/* Table */}
      <div className="bg-white border border-pro-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-pro-accent" size={24} />
          </div>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const r = roleLabels[u.role] ?? roleLabels.client;
                const Icon = r.icon;
                return (
                  <TableRow key={`${u.user_id}-${u.source}`}>
                    <TableCell>
                      <div className="font-medium text-pro-text">{u.prenom} {u.nom}</div>
                      <div className="text-xs text-pro-muted">{u.email ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${r.tone}`}>
                        <Icon size={12} />
                        {r.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-pro-text-soft">
                      {u.type_client === "b2b" ? "B2B" : u.type_client === "particulier" ? "Particulier" : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-pro-text-soft">{u.societe || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusTone[u.account_status] ?? statusTone.active}>
                        {u.account_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-pro-muted">
                      {new Date(u.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
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
