import { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RoleOption = "admin" | "super_admin" | "manager" | "convoyeur" | "sous_traitant" | "client";

interface OrgOption {
  id: string;
  legal_name: string;
}

interface Props {
  onCreated?: () => void;
}

export function CreateAccountDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);

  const [form, setForm] = useState({
    email: "",
    password: "",
    prenom: "",
    nom: "",
    telephone: "",
    role: "client" as RoleOption,
    type_client: "particulier" as "particulier" | "b2b",
    societe: "",
    siret: "",
    organization_id: "",
    member_role: "member" as "owner" | "admin" | "member",
  });

  useEffect(() => {
    if (!open) return;
    void supabase
      .from("organizations")
      .select("id, legal_name")
      .order("legal_name")
      .then(({ data }) => setOrgs((data ?? []) as OrgOption[]));
  }, [open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    if (!form.email || !form.password || form.password.length < 8) {
      toast.error("Email et mot de passe (min. 8 caractères) requis");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expirée");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            prenom: form.prenom,
            nom: form.nom,
            telephone: form.telephone || undefined,
            role: form.role,
            type_client: form.role === "client" ? form.type_client : undefined,
            societe: form.societe || undefined,
            siret: form.siret || undefined,
            organization_id: form.organization_id || undefined,
            member_role: form.organization_id ? form.member_role : undefined,
          }),
        },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Erreur création");

      toast.success("Compte créé avec succès");
      setOpen(false);
      setForm({
        email: "", password: "", prenom: "", nom: "", telephone: "",
        role: "client", type_client: "particulier", societe: "", siret: "",
        organization_id: "", member_role: "member",
      });
      onCreated?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const showOrg = ["client", "manager", "sous_traitant", "convoyeur"].includes(form.role);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus size={16} /> Créer un compte
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer un compte utilisateur</DialogTitle>
          <DialogDescription>
            Le compte est créé immédiatement et confirmé. L'utilisateur pourra se connecter avec son mot de passe.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <Field label="Email *">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Mot de passe * (min. 8)">
            <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} />
          </Field>
          <Field label="Prénom">
            <Input value={form.prenom} onChange={(e) => set("prenom", e.target.value)} />
          </Field>
          <Field label="Nom">
            <Input value={form.nom} onChange={(e) => set("nom", e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <Input value={form.telephone} onChange={(e) => set("telephone", e.target.value)} />
          </Field>
          <Field label="Rôle *">
            <Select value={form.role} onValueChange={(v) => set("role", v as RoleOption)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="convoyeur">Convoyeur</SelectItem>
                <SelectItem value="manager">Manager (org)</SelectItem>
                <SelectItem value="sous_traitant">Sous-traitant</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {form.role === "client" && (
            <Field label="Type client">
              <Select value={form.type_client} onValueChange={(v) => set("type_client", v as "particulier" | "b2b")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="particulier">Particulier</SelectItem>
                  <SelectItem value="b2b">Entreprise (B2B)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Société">
            <Input value={form.societe} onChange={(e) => set("societe", e.target.value)} />
          </Field>
          <Field label="SIRET">
            <Input value={form.siret} onChange={(e) => set("siret", e.target.value)} />
          </Field>

          {showOrg && (
            <>
              <Field label="Rattacher à une organisation">
                <Select value={form.organization_id || "none"} onValueChange={(v) => set("organization_id", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.legal_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {form.organization_id && (
                <Field label="Rôle dans l'organisation">
                  <Select value={form.member_role} onValueChange={(v) => set("member_role", v as "owner" | "admin" | "member")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membre</SelectItem>
                      <SelectItem value="admin">Admin org</SelectItem>
                      <SelectItem value="owner">Propriétaire</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" size={16} /> : "Créer le compte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-pro-muted">{label}</Label>
      {children}
    </div>
  );
}
