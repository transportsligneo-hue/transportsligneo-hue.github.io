import { useState } from "react";
import { Loader2, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DevisRow {
  id: string;
  numero: string | null;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  depart: string | null;
  arrivee: string | null;
  prix_estime: number | null;
  statut: string | null;
  created_at: string;
  user_id: string | null;
}

interface Props {
  /** Compte client cible. */
  userId: string;
  clientEmail?: string | null;
  clientNom?: string | null;
  clientPrenom?: string | null;
  clientTelephone?: string | null;
  onAttached?: () => void;
}

export function AttachDevisToClientDialog({
  userId,
  clientEmail,
  clientNom,
  clientPrenom,
  clientTelephone,
  onAttached,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<DevisRow[]>([]);

  const cols =
    "id, numero, nom, prenom, email, depart, arrivee, prix_estime, statut, created_at, user_id";

  async function runSearch() {
    setBusy(true);
    try {
      const term = q.trim();
      let query = supabase
        .from("devis")
        .select(cols)
        .order("created_at", { ascending: false })
        .limit(30);
      if (term.length >= 2) {
        const like = `%${term}%`;
        query = query.or(
          `numero.ilike.${like},nom.ilike.${like},prenom.ilike.${like},email.ilike.${like},depart.ilike.${like},arrivee.ilike.${like}`,
        );
      } else {
        // Par défaut : les devis pas encore rattachés à un compte
        query = query.is("user_id", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      setResults((data ?? []) as DevisRow[]);
      setSearched(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function attach(d: DevisRow) {
    setBusy(true);
    try {
      const patch: Record<string, unknown> = { user_id: userId };
      if (clientEmail) patch.email = clientEmail;
      if (clientNom) patch.nom = clientNom;
      if (clientPrenom) patch.prenom = clientPrenom;
      if (clientTelephone) patch.telephone = clientTelephone;

      const { error } = await supabase.from("devis").update(patch).eq("id", d.id);
      if (error) throw error;

      toast.success(`Devis ${d.numero ?? d.id.slice(0, 8)} rattaché à ce compte`);
      setOpen(false);
      setQ("");
      setResults([]);
      setSearched(false);
      onAttached?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !searched) void runSearch();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Link2 size={14} /> Rattacher un devis
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rattacher un devis à ce compte</DialogTitle>
          <DialogDescription>
            Cherchez le devis par numéro, nom, email ou ville. Il apparaîtra aussitôt dans l'espace
            du client, même s'il n'a pas encore choisi son mot de passe.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 py-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
            placeholder="DEV-TLG-2026-#123, nom, email, ville…"
          />
          <Button type="button" onClick={() => void runSearch()} disabled={busy} className="gap-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Chercher
          </Button>
        </div>

        {searched && results.length === 0 && !busy ? (
          <p className="py-4 text-sm text-slate-500">Aucun devis trouvé.</p>
        ) : null}

        <div className="space-y-2">
          {results.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-900">
                  {d.numero ?? d.id.slice(0, 8)}
                  {d.user_id ? (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-sans text-[11px] text-amber-800">
                      déjà rattaché
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-sm text-slate-700">
                  {[d.prenom, d.nom].filter(Boolean).join(" ") || d.email || "—"} ·{" "}
                  {d.depart ?? "?"} → {d.arrivee ?? "?"}
                </p>
                <p className="text-xs text-slate-500">
                  {d.prix_estime ? `${d.prix_estime.toLocaleString("fr-FR")} €` : "—"} ·{" "}
                  {(d.statut ?? "").replace(/_/g, " ")} ·{" "}
                  {new Date(d.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <Button size="sm" disabled={busy} onClick={() => void attach(d)}>
                Rattacher
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
