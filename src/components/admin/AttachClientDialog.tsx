import { useState } from "react";
import { Loader2, Search, UserPlus, Link2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  const [busy, setBusy] = useState(false);

  // --- Recherche compte existant ---
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [searched, setSearched] = useState(false);

  // --- Création de compte ---
  const [form, setForm] = useState({
    email: "",
    password: "",
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

  /** Rattache le client (profil) à la mission courante. */
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

      toast.success(`Mission rattachée à ${nomComplet}`);
      setOpen(false);
      onAttached?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createAndAttach() {
    if (!form.email || form.password.length < 8) {
      toast.error("Email et mot de passe (min. 8 caractères) requis");
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
            password: form.password,
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
          <DialogTitle>Rattacher la mission à un client</DittleFix />
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
