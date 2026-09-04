import { useState } from "react";
import { Loader2, Search, UserPlus, Link2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendAccountAccessInvite } from "@/lib/admin-accounts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface ProfileRow {
  user_id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  societe: string | null;
}

interface Props {
  /** Trajet (opérationnel) à rattacher. */
  trajetId?: string | null;
  /** Numéro de mission — sert à retrouver la fiche côté espace client. */
  numeroMission?: string | null;
  currentEmail?: string | null;
  onAttached?: () => void;
  triggerLabel?: string;
}

export function AttachClientDialog({
  trajetId,
  numeroMission,
  currentEmail,
  onAttached,
  triggerLabel = "Rattacher un client",
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"existant" | "nouveau">("existant");
  const sendInvite = useServerFn(sendAccountAccessInvite);
  const [busy, setBusy] = useState(false);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [searched, setSearched] = useState(false);

  const [form, setForm] = useState({
    email: "",
    prenom: "",
    nom: "",
    telephone: "",
    societe: "",
    type_client: "particulier" as "particulier" | "b2b",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function search() {
    const term = q.trim();
    if (term.length < 2) return;
    setBusy(true);
    const like = `%${term}%`;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, prenom, nom, email, telephone, societe")
      .or(`email.ilike.${like},nom.ilike.${like},prenom.ilike.${like},societe.ilike.${like}`)
      .limit(20);
    setResults((data ?? []) as ProfileRow[]);
    setSearched(true);
    setBusy(false);
  }

  async function attach(p: ProfileRow) {
    if (!p.email) {
      toast.error("Ce compte n'a pas d'email : impossible de le rattacher.");
      return;
    }
    setBusy(true);
    try {
      const nomComplet = `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || p.societe || p.email;

      if (trajetId) {
        const { error } = await supabase
          .from("trajets")
          .update({
            client_email: p.email,
            client_nom: nomComplet,
            client_telephone: p.telephone ?? null,
          })
          .eq("id", trajetId);
        if (error) throw error;
      }

      if (numeroMission) {
        await supabase
          .from("missions")
          .update({
            user_id: p.user_id,
            email: p.email,
            nom: p.nom ?? nomComplet,
            prenom: p.prenom ?? "",
            telephone: p.telephone ?? null,
          })
          .eq("numero", numeroMission);
      }

      // Le devis et les factures liés suivent automatiquement le même client.
      let devisMaj = 0;
      let facturesMaj = 0;
      if (trajetId) {
        const { data: t } = await supabase
          .from("trajets")
          .select("devis_id, mission_id")
          .eq("id", trajetId)
          .maybeSingle();
        const lien = (t ?? null) as { devis_id: string | null; mission_id: string | null } | null;

        if (lien?.devis_id) {
          const { error: devisErr } = await supabase
            .from("devis")
            .update({
              user_id: p.user_id,
              email: p.email,
              nom: p.nom ?? nomComplet,
              prenom: p.prenom ?? "",
              telephone: p.telephone ?? null,
            })
            .eq("id", lien.devis_id);
          if (!devisErr) devisMaj += 1;
        }

        if (lien?.mission_id) {
          const { data: fRows, error: facErr } = await supabase
            .from("factures")
            .update({
              client_email: p.email,
              client_nom: p.societe ?? nomComplet,
              client_prenom: p.prenom ?? null,
            })
            .eq("mission_id", lien.mission_id)
            .select("id");
          if (!facErr) facturesMaj = (fRows ?? []).length;
        }
      }

      const details = [
        devisMaj > 0 ? "devis" : null,
        facturesMaj > 0 ? `${facturesMaj} facture${facturesMaj > 1 ? "s" : ""}` : null,
      ].filter(Boolean);

      toast.success(
        details.length > 0
          ? `Mission rattachée à ${nomComplet} · ${details.join(" et ")} mis à jour`
          : `Mission rattachée à ${nomComplet}`,
      );
      setOpen(false);
      onAttached?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function randomTempPassword() {
    return `Lgn-${crypto.randomUUID()}-${Date.now().toString(36)}!`;
  }

  async function createAndAttach() {
    if (!form.email.trim()) {
      toast.error("L'adresse email est requise");
      return;
    }
    setBusy(true);
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
            email: form.email.trim(),
            password: randomTempPassword(),
            prenom: form.prenom,
            nom: form.nom,
            telephone: form.telephone || undefined,
            role: "client",
            type_client: form.type_client,
            societe: form.societe || undefined,
          }),
        },
      );
      const json = (await res.json()) as { ok?: boolean; user_id?: string; error?: string };
      if (!res.ok || !json.ok || !json.user_id) throw new Error(json.error ?? "Erreur création");

      try {
        await sendInvite({
          data: {
            email: form.email.trim(),
            prenom: form.prenom,
            role: "client",
            origin: window.location.origin,
          },
        });
        toast.success("Invitation envoyée : le client choisira son mot de passe.");
      } catch (e) {
        toast.error(`Compte créé, mais l'invitation n'est pas partie : ${(e as Error).message}`);
      }

      await attach({
        user_id: json.user_id,
        prenom: form.prenom,
        nom: form.nom,
        email: form.email.trim(),
        telephone: form.telephone || null,
        societe: form.societe || null,
      });
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Link2 size={14} /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rattacher la mission à un client</DialogTitle>
          <DialogDescription>
            {currentEmail
              ? `Client actuel : ${currentEmail}. Le rattachement remplacera ce contact.`
              : "La mission apparaîtra immédiatement dans l'espace du client choisi."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setTab("existant")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "existant" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Compte existant
          </button>
          <button
            type="button"
            onClick={() => setTab("nouveau")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "nouveau" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Nouveau compte
          </button>
        </div>

        {tab === "existant" ? (
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
                placeholder="Nom, email, société…"
              />
              <Button onClick={() => void search()} disabled={busy || q.trim().length < 2}>
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
              </Button>
            </div>

            {searched && results.length === 0 && (
              <p className="text-sm text-slate-500 py-4 text-center">
                Aucun compte trouvé. Créez-en un dans l'onglet « Nouveau compte ».
              </p>
            )}

            <div className="space-y-2">
              {results.map((p) => (
                <div
                  key={p.user_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {`${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || p.societe || "—"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {p.email ?? "sans email"}{p.societe ? ` · ${p.societe}` : ""}
                    </p>
                  </div>
                  <Button size="sm" disabled={busy} onClick={() => void attach(p)} className="shrink-0 gap-1.5">
                    <CheckCircle2 size={14} /> Rattacher
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <Field label="Email *">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
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
            <Field label="Société">
              <Input value={form.societe} onChange={(e) => set("societe", e.target.value)} />
            </Field>
            <Field label="Type de client">
              <Select value={form.type_client} onValueChange={(v) => set("type_client", v as "particulier" | "b2b")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="particulier">Particulier</SelectItem>
                  <SelectItem value="b2b">Entreprise (B2B)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="sm:col-span-2 text-xs text-slate-500">
              Aucun mot de passe à saisir : le client reçoit un email d'invitation et crée lui-même son mot de passe.
            </p>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={() => void createAndAttach()} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                Créer le compte et rattacher
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-slate-500">{label}</Label>
      {children}
    </div>
  );
}
