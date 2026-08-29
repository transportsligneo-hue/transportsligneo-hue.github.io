import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Building2, Plus, Trash2, UserCircle2, Mail, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/admin/AdminUI";
import { LogoLoader } from "@/components/brand/LogoLoader";

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

const roleBadgeTone: Record<string, string> = {
  client_b2b: "blue",
  flotte_partenaire: "green",
  sous_traitant: "orange",
  client_particulier: "grey",
  prospect: "violet",
};

const roleLabels: Record<string, string> = {
  client_b2b: "Client B2B",
  flotte_partenaire: "Flotte partenaire",
  sous_traitant: "Sous-traitant",
  client_particulier: "Client particulier",
  prospect: "Prospect",
};

const statusBadgeTone: Record<string, string> = {
  active: "green",
  pending: "orange",
  suspended: "red",
  archived: "grey",
};

const scoreBadgeTone: Record<string, string> = {
  hot: "red",
  warm: "orange",
  cold: "grey",
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

      // Profils B2B/flotte pas encore rattachés à une vraie organisation.
      // Dédoublonnage : on masque aussi les profils dont la société ou le SIRET
      // correspond déjà à une organisation existante (évite les doublons type "CAT FRANCE").
      const orgKeys = new Set<string>();
      (orgs ?? []).forEach((o) => {
        if (o.siret) orgKeys.add(`s:${o.siret.replace(/\s/g, "")}`);
        [o.legal_name, o.commercial_name].forEach((n) => {
          if (n) orgKeys.add(`n:${n.trim().toLocaleLowerCase("fr-FR")}`);
        });
      });
      const isDuplicateOfOrg = (p: { siret?: string | null; societe?: string | null }) =>
        (p.siret && orgKeys.has(`s:${p.siret.replace(/\s/g, "")}`)) ||
        (p.societe && orgKeys.has(`n:${p.societe.trim().toLocaleLowerCase("fr-FR")}`));

      const profileRows: Row[] = (profiles ?? [])
        .filter((p: any) => !p.organization_id && !isDuplicateOfOrg(p))

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

  const orgsCount = rows.filter((r) => r.kind === "org").length;
  const flottesCount = rows.filter((r) => r.roles.includes("flotte_partenaire")).length;
  const hotCount = rows.filter((r) => r.score_category === "hot").length;

  return (
    <div>
      {/* ===== En-tête ===== */}
      <div className="dvx-head">
        <div className="min-w-0">
          <h1 className="dvx-title">Organisations & clients</h1>
          <p className="dvx-sub">
            Entreprises B2B, flottes partenaires, sous-traitants et comptes clients pro.
          </p>
        </div>
        <button type="button" className="dvx-cta" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Nouvelle organisation
        </button>
      </div>

      {/* ===== Statistiques ===== */}
      <div className="dvx-stats">
        <div className="dvx-stat">
          <span className="dvx-stat-ic blue"><Building2 size={17} /></span>
          <p className="dvx-stat-k">Total</p>
          <p className="dvx-stat-v">{rows.length}</p>
          <p className="dvx-stat-t dim">Organisations & clients pro</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic violet"><Building2 size={17} /></span>
          <p className="dvx-stat-k">Organisations</p>
          <p className="dvx-stat-v">{orgsCount}</p>
          <p className="dvx-stat-t dim">Comptes rattachés</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic green"><UserCircle2 size={17} /></span>
          <p className="dvx-stat-k">Flottes partenaires</p>
          <p className="dvx-stat-v">{flottesCount}</p>
          <p className={`dvx-stat-t ${flottesCount > 0 ? "up" : "dim"}`}>Rôle flotte actif</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic orange"><Building2 size={17} /></span>
          <p className="dvx-stat-k">Score chaud</p>
          <p className="dvx-stat-v">{hotCount}</p>
          <p className={`dvx-stat-t ${hotCount > 0 ? "up" : "dim"}`}>{hotCount > 0 ? "À relancer en priorité" : "Aucun compte chaud"}</p>
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
            placeholder="Rechercher (nom, SIRET, email)…"
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

      {loading ? (
        <div className="flex justify-center py-12">
          <LogoLoader label="Chargement des organisations…" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Aucune organisation" description="Aucune organisation ne correspond à ces filtres." />
      ) : (
        <div className="space-y-3.5">
          {filtered.map((o) => (
            <div key={o.id} className={`dvx-card ${o.status === "archived" ? "is-archived" : ""}`}>
              {/* En-tête de carte */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className={`dvx-badge ${statusBadgeTone[o.status] ?? "grey"}`}>{o.status}</span>
                  {o.kind === "org" && o.account_type === "flotte" ? (
                    <span className="dvx-badge violet">Flotte</span>
                  ) : o.kind === "org" ? (
                    <span className="dvx-badge blue">B2B</span>
                  ) : null}
                  {o.roles.map((r) => (
                    <span key={r} className={`dvx-badge ${roleBadgeTone[r] ?? "grey"}`}>{roleLabels[r] ?? r}</span>
                  ))}
                  <span className="text-[11.5px] text-[#a3a4ac]">
                    {new Date(o.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                {o.kind === "org" && (
                  <div className="text-right shrink-0">
                    <span className={`dvx-badge ${scoreBadgeTone[o.score_category] ?? "grey"}`}>
                      {o.score} · {o.score_category}
                    </span>
                  </div>
                )}
              </div>

              {/* Corps */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="flex items-start gap-3 min-w-0">
                  <ClientLogo
                    src={o.logo_url}
                    name={o.legal_name}
                    isCompany
                    kind={o.account_type === "flotte" ? "flotte" : "b2b"}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-[#14161c] truncate">{o.legal_name}</p>
                    <p className="mt-1 text-[11.5px] text-[#70727d] truncate">
                      {o.commercial_name ? `${o.commercial_name} · ` : ""}
                      {o.siret ?? (o.kind === "profile" ? "Compte client" : "Sans SIRET")}
                    </p>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="dvx-col-k">Contact</p>
                  {o.primary_contact_email && (
                    <p className="text-[12.5px] text-[#14161c] flex items-center gap-1.5 truncate"><Mail size={12} className="text-[#a3a4ac] shrink-0" />{o.primary_contact_email}</p>
                  )}
                  {o.primary_contact_phone && (
                    <p className="mt-1.5 text-[12.5px] text-[#14161c] flex items-center gap-1.5"><Phone size={12} className="text-[#a3a4ac] shrink-0" />{o.primary_contact_phone}</p>
                  )}
                  {!o.primary_contact_email && !o.primary_contact_phone && <p className="text-[12.5px] text-[#a3a4ac]">—</p>}
                </div>
              </div>

              {/* Pied de carte */}
              <div className="dvx-foot">
                {o.kind === "org" ? (
                  <Link to="/admin/organisations/$orgId" params={{ orgId: o.id }} className="dvx-btn solid">
                    Voir →
                  </Link>
                ) : (
                  <Link to="/admin/clients/$clientId" params={{ clientId: o.profileUserId! }} className="dvx-btn solid">
                    Voir →
                  </Link>
                )}
                <button
                  type="button"
                  className="dvx-ico"
                  title={o.kind === "org" ? "Supprimer l'organisation" : "Archiver le client"}
                  onClick={() => setToDelete(o)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
          <Button onClick={submit} disabled={saving} className="admin-btn-blue text-white border-transparent hover:text-white">
            {saving && <Loader2 className="animate-spin mr-2" size={14} />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
