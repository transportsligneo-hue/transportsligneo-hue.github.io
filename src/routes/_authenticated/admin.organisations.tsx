import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Building2, Plus, Trash2, UserCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ClientLogo } from "@/components/admin/ClientLogo";

export const Route = createFileRoute("/_authenticated/admin/organisations")({
  component: AdminOrganisations,
});

type Row = {
  // Common
  kind: "org" | "profile";
  id: string; // organization id OR `profile-${user_id}`
  legal_name: string;
  commercial_name: string | null;
  siret: string | null;
  status: string;
  score: number;
  score_category: string;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  created_at: string;
  roles: string[];
  logo_url?: string | null;
  account_type?: "b2b_standard" | "flotte" | null;
  // For profile rows
  profileUserId?: string;
};

const roleStyles: Record<string, string> = {
  client_b2b: "bg-blue-100 text-blue-700 border-blue-200",
  flotte_partenaire: "bg-emerald-100 text-emerald-700 border-emerald-200",
  sous_traitant: "bg-orange-100 text-orange-700 border-orange-200",
  client_particulier: "bg-slate-100 text-slate-700 border-slate-200",
  prospect: "bg-amber-100 text-amber-700 border-amber-200",
};

const roleLabels: Record<string, string> = {
  client_b2b: "Client B2B",
  flotte_partenaire: "Flotte partenaire",
  sous_traitant: "Sous-traitant",
  client_particulier: "Client particulier",
  prospect: "Prospect",
};

function AdminOrganisations() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ data: orgs }, { data: rolesRows }, { data: profiles }] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, legal_name, commercial_name, siret, sector, size, status, score, score_category, primary_contact_email, primary_contact_phone, created_at, logo_url, account_type")
          .order("created_at", { ascending: false }),
        supabase.from("organization_roles").select("organization_id, role, active"),
        supabase
          .from("profiles")
          .select("user_id, email, nom, prenom, telephone, societe, siret, type_client, statut, organization_id, created_at, logo_url, avatar_url")
          .in("type_client", ["b2b", "flotte"])
          .order("created_at", { ascending: false }),
      ]);

      const rolesByOrg = new Map<string, string[]>();
      (rolesRows ?? []).forEach((r) => {
        if (!r.active) return;
        const arr = rolesByOrg.get(r.organization_id) ?? [];
        arr.push(r.role);
        rolesByOrg.set(r.organization_id, arr);
      });

      const orgRows: Row[] = (orgs ?? []).map((o) => ({
        kind: "org",
        id: o.id,
        legal_name: o.legal_name,
        commercial_name: o.commercial_name,
        siret: o.siret,
        status: o.status,
        score: o.score,
        score_category: o.score_category,
        primary_contact_email: o.primary_contact_email,
        primary_contact_phone: o.primary_contact_phone,
        created_at: o.created_at,
        roles: rolesByOrg.get(o.id) ?? [],
        logo_url: (o as { logo_url?: string | null }).logo_url ?? null,
        account_type: ((o as { account_type?: string | null }).account_type as "b2b_standard" | "flotte" | null) ?? null,
      }));

      // Profiles B2B/flotte not yet attached to a real organization
      const linkedUserIds = new Set<string>();
      // (We can't know directly which profiles correspond to which org owner without org_members,
      // so just skip those that have organization_id set.)
      const profileRows: Row[] = (profiles ?? [])
        .filter((p: any) => !p.organization_id && !linkedUserIds.has(p.user_id))
        .map((p: any) => {
          const legal =
            (p.societe && p.societe.trim()) ||
            [p.prenom, p.nom].filter(Boolean).join(" ").trim() ||
            p.email ||
            "—";
          return {
            kind: "profile" as const,
            id: `profile-${p.user_id}`,
            legal_name: legal,
            commercial_name: null,
            siret: p.siret,
            status: p.statut ?? "active",
            score: 0,
            score_category: "cold",
            primary_contact_email: p.email,
            primary_contact_phone: p.telephone,
            created_at: p.created_at,
            roles: [p.type_client === "flotte" ? "flotte_partenaire" : "client_b2b"],
            logo_url: p.logo_url ?? p.avatar_url ?? null,
            profileUserId: p.user_id,
          };
        });

      setRows([...orgRows, ...profileRows]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (roleFilter !== "all" && !o.roles.includes(roleFilter)) return false;
      if (!q) return true;
      return (
        o.legal_name.toLowerCase().includes(q) ||
        (o.commercial_name ?? "").toLowerCase().includes(q) ||
        (o.siret ?? "").includes(q) ||
        (o.primary_contact_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, roleFilter, statusFilter]);

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      if (toDelete.kind === "org") {
        // Best-effort cleanup of dependent tables (those without ON DELETE CASCADE)
        await supabase.from("organization_roles").delete().eq("organization_id", toDelete.id);
        await supabase.from("organization_members").delete().eq("organization_id", toDelete.id);
        const { error } = await supabase.from("organizations").delete().eq("id", toDelete.id);
        if (error) throw error;
        toast.success("Organisation supprimée");
      } else if (toDelete.kind === "profile" && toDelete.profileUserId) {
        // Don't hard-delete the auth user — just archive the profile so it disappears from the list.
        const { error } = await supabase
          .from("profiles")
          .update({ statut: "archive", type_client: "particulier" })
          .eq("user_id", toDelete.profileUserId);
        if (error) throw error;
        toast.success("Client archivé");
      }
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        breadcrumb="Organisations"
        eyebrow="Comptes professionnels"
        title="Organisations &"
        highlight="clients"
        subtitle="Entreprises B2B, flottes partenaires, sous-traitants et comptes clients pro."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus size={16} /> Nouvelle organisation
          </Button>
        }
      />


      <div className="bg-white border border-pro-border rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, SIRET, email)…"
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="Rôle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="client_b2b">Client B2B</SelectItem>
            <SelectItem value="flotte_partenaire">Flotte partenaire</SelectItem>
            <SelectItem value="sous_traitant">Sous-traitant</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
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
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-pro-accent" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-pro-muted text-sm">Aucune organisation trouvée.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation / Client</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ClientLogo
                        src={o.logo_url}
                        name={o.legal_name}
                        isCompany
                        size="sm"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-pro-text">{o.legal_name}</div>
                          {o.kind === "org" && o.account_type === "flotte" ? (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200" variant="outline">Flotte</Badge>
                          ) : o.kind === "org" ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200" variant="outline">B2B</Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-pro-muted">
                          {o.commercial_name ? `${o.commercial_name} · ` : ""}
                          {o.siret ?? (o.kind === "profile" ? "Compte client" : "Sans SIRET")}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {o.roles.length === 0 ? (
                        <span className="text-xs text-pro-muted">—</span>
                      ) : (
                        o.roles.map((r) => (
                          <Badge key={r} variant="outline" className={roleStyles[r] ?? ""}>
                            {roleLabels[r] ?? r}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{o.primary_contact_email ?? "—"}</div>
                    <div className="text-xs text-pro-muted">{o.primary_contact_phone ?? ""}</div>
                  </TableCell>
                  <TableCell>
                    {o.kind === "org" ? (
                      <Badge variant="outline" className={
                        o.score_category === "hot" ? "bg-red-100 text-red-700 border-red-200"
                        : o.score_category === "warm" ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                      }>
                        {o.score} · {o.score_category}
                      </Badge>
                    ) : (
                      <span className="text-xs text-pro-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {o.kind === "org" ? (
                        <Link
                          to="/admin/organisations/$orgId"
                          params={{ orgId: o.id }}
                          className="text-xs text-pro-accent hover:underline"
                        >
                          Voir →
                        </Link>
                      ) : (
                        <Link
                          to="/admin/clients/$clientId"
                          params={{ clientId: o.profileUserId! }}
                          className="text-xs text-pro-accent hover:underline"
                        >
                          Voir →
                        </Link>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setToDelete(o)}
                        title={o.kind === "org" ? "Supprimer l'organisation" : "Archiver le client"}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toDelete?.kind === "org" ? "Supprimer cette organisation ?" : "Archiver ce client ?"}
            </DialogTitle>
            <DialogDescription>
              {toDelete?.kind === "org" ? (
                <>
                  L'organisation <strong>{toDelete?.legal_name}</strong> sera définitivement
                  supprimée, ainsi que ses rôles et liens membres. Cette action est irréversible.
                </>
              ) : (
                <>
                  Le compte client <strong>{toDelete?.legal_name}</strong> sera archivé et
                  n'apparaîtra plus dans cette liste. L'utilisateur et ses données restent en base.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="animate-spin mr-2" size={14} />}
              {toDelete?.kind === "org" ? "Supprimer" : "Archiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [legalName, setLegalName] = useState("");
  const [commercialName, setCommercialName] = useState("");
  const [siret, setSiret] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [role, setRole] = useState("client_b2b");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!legalName.trim()) {
      toast.error("Le nom légal est obligatoire");
      return;
    }
    setSaving(true);
    try {
      const { data: org, error } = await supabase
        .from("organizations")
        .insert({
          legal_name: legalName.trim(),
          commercial_name: commercialName.trim() || null,
          siret: siret.trim() || null,
          primary_contact_name: contactName.trim() || null,
          primary_contact_email: contactEmail.trim() || null,
          primary_contact_phone: contactPhone.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("organization_roles").insert({
        organization_id: org.id,
        role,
        active: true,
      });

      toast.success("Organisation créée");
      onOpenChange(false);
      setLegalName(""); setCommercialName(""); setSiret("");
      setContactEmail(""); setContactPhone(""); setContactName("");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur création");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle organisation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nom légal *</Label>
            <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nom commercial</Label>
              <Input value={commercialName} onChange={(e) => setCommercialName(e.target.value)} />
            </div>
            <div>
              <Label>SIRET</Label>
              <Input value={siret} onChange={(e) => setSiret(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Rôle initial</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client_b2b">Client B2B</SelectItem>
                <SelectItem value="flotte_partenaire">Flotte partenaire</SelectItem>
                <SelectItem value="sous_traitant">Sous-traitant</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contact principal</Label>
            <Input placeholder="Nom" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <Input placeholder="Téléphone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="animate-spin mr-2" size={14} />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
