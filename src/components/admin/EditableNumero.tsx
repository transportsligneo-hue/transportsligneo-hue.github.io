import { useState } from "react";
import { Pencil, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  table: "devis" | "missions" | "attributions" | "factures";
  id: string;
  column?: string; // default "numero"
  value: string;
  onSaved: (nextValue: string) => void;
  className?: string;
}

/**
 * Bouton crayon permettant à l'admin de renommer le numéro d'un devis,
 * d'une mission ou d'une facture. Le PDF utilise directement cette valeur,
 * donc la modification est propagée partout automatiquement.
 */
export function EditableNumero({ table, id, column = "numero", value, onSaved, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = draft.trim();
    if (!next) { toast.error("Numéro requis"); return; }
    if (next === value) { setEditing(false); return; }
    if (!/^[A-Za-z0-9 #._\-\/]+$/.test(next)) {
      toast.error("Caractères autorisés : lettres, chiffres, espace, # . _ - /");
      return;
    }
    setSaving(true);
    // Mission : passer par la RPC admin pour propager le numéro
    // sur l'attribution ET le trajet lié (fiches, EDL, PDF, suivi).
    if (table === "attributions" && column === "numero_mission") {
      const { error: rpcError } = await (supabase as any).rpc("admin_rename_mission_numero", {
        _attribution_id: id,
        _numero: next,
      });
      setSaving(false);
      if (rpcError) {
        toast.error("Impossible de renommer", { description: rpcError.message });
        return;
      }
      toast.success("Numéro mis à jour partout");
      onSaved(next);
      setEditing(false);
      return;
    }
    const { data, error } = await (supabase as any)
      .from(table)
      .update({ [column]: next })
      .eq("id", id)
      .select("id");
    setSaving(false);
    if (!error && (!data || data.length === 0)) {
      toast.error("Modification refusée", { description: "Aucune ligne mise à jour (droits insuffisants)." });
      return;
    }

    if (error) {
      const msg = error.message?.includes("duplicate") || error.code === "23505"
        ? "Ce numéro est déjà utilisé"
        : error.message || "Impossible de renommer";
      toast.error(msg);
      return;
    }
    toast.success("Numéro mis à jour");
    onSaved(next);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        title="Renommer (admin)"
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-pro-muted hover:text-pro-accent hover:bg-pro-accent/10 transition-colors ${className ?? ""}`}
      >
        <Pencil size={12} />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        disabled={saving}
        className="rounded-md border border-pro-border bg-white/80 px-2 py-1 text-sm font-mono w-44 focus:outline-none focus:ring-2 focus:ring-pro-accent"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        title="Enregistrer"
        className="inline-flex items-center justify-center rounded-md p-1 text-green-600 hover:bg-green-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={saving}
        title="Annuler"
        className="inline-flex items-center justify-center rounded-md p-1 text-pro-muted hover:bg-pro-border/40"
      >
        <X size={14} />
      </button>
    </span>
  );
}
