import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Building2, Plus } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/organisations")({
  component: AdminOrganisations,
});

type Org = {
  id: string;
  legal_name: string;
  commercial_name: string | null;
  siret: string | null;
  sector: string | null;
  size: string | null;
  status: string;
  score: number;
  score_category: string;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  created_at: string;
  roles: string[];
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
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ data: rows }, { data: rolesRows }] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, legal_name, commercial_name, siret, sector, size, status, score, score_category, primary_contact_email, primary_contact_phone, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("organization_roles").select("organization_id, role, active"),
      ]);

      const rolesByOrg = new Map<string, string[]>();
      (rolesRows ?? []).forEach((r) => {
        if (!r.active) return;
        const arr = rolesByOrg.get(r.organization_id) ?? [];
        arr.push(r.role);
        rolesByOrg.set(r.organization_id, arr);
      });

      setOrgs(
        (rows ?? []).map((o) => ({
          ...o,
          roles: rolesByOrg.get(o.id) ?? [],
        })),
      );
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orgs.filter((o) => {
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
  }, [orgs, search, roleFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-pro-accent/10 flex items-center justify-center">
            <Building2 className="text-pro-accent" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-pro-text">Organisations</h1>
            <p className="text-sm text-pro-muted">Entreprises B2B, flottes partenaires et sous-traitants.</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus size={16} /> Nouvelle organisation
        </Button>
      </header>

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
                <TableHead>Organisation</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="font-medium text-pro-text">{o.legal_name}</div>
                    <div className="text-xs text-pro-muted">
                      {o.commercial_name ? `${o.commercial_name} · ` : ""}
                      {o.siret ?? "Sans SIRET"}
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
                    <Badge variant="outline" className={
                      o.score_category === "hot" ? "bg-red-100 text-red-700 border-red-200"
                      : o.score_category === "warm" ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                    }>
                      {o.score} · {o.score_category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to="/admin/organisations/$orgId" params={{ orgId: o.id }} className="text-xs text-pro-accent hover:underline">
                      Voir →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
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
