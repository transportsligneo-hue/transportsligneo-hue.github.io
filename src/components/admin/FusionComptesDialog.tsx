/** Fusion de deux comptes : tout ce que possède l'un passe sur l'autre. */
import { useMemo, useState } from "react";
import { GitMerge, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmToast } from "@/lib/confirm-toast";

export interface FusionUser {
  user_id: string;
  email: string | null;
  nom: string;
  prenom: string;
  role: string;
}

const label = (u: FusionUser) => `${`${u.prenom ?? ""} ${u.nom ?? ""}`.trim() || "Sans nom"} · ${u.email ?? "sans e-mail"}`;

export function FusionComptesDialog({
  users, garderInitial, sourceInitial, onClose, onDone,
}: {
  users: FusionUser[];
  garderInitial?: string;
  sourceInitial?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [garder, setGarder] = useState(garderInitial ?? "");
  const [source, setSource] = useState(sourceInitial ?? "");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const liste = useMemo(() => {
    const t = q.trim().toLowerCase();
    return users
      .filter((u) => u.role !== "admin" && u.role !== "super_admin")
      .filter((u) => !t || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(t) || u.user_id === garder || u.user_id === source)
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  }, [users, q, garder, source]);

  const fusionner = async () => {
    if (!garder || !source || garder === source) return toast.error("Choisis deux comptes différents");
    const g = users.find((u) => u.user_id === garder);
    const s = users.find((u) => u.user_id === source);
    const ok = await confirmToast(`Fusionner ${s?.email} dans ${g?.email} ?`, {
      description: "Les missions, devis, factures et adresses de l'ancien compte passent sur le compte gardé. Cette action ne se défait pas.",
      confirmLabel: "Fusionner", variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("fusionner_comptes", { _garder: garder, _source: source });
    setBusy(false);
    if (error) return toast.error(error.message);
    const n = Object.values((data?.deplace ?? {}) as Record<string, number>).reduce((a, b) => a + Number(b), 0);
    toast.success(`Fusion faite : ${n} élément${n > 1 ? "s" : ""} déplacé${n > 1 ? "s" : ""}`);
    if ((data?.non_deplace ?? []).length) toast.message(`Non déplacé (déjà présent côté gardé) : ${(data.non_deplace as string[]).slice(0, 4).join(", ")}`);

    const supprimer = await confirmToast(`Supprimer l'ancien compte ${s?.email} ?`, {
      description: "Il est vide maintenant. Tu peux aussi le garder archivé.",
      confirmLabel: "Supprimer", cancelLabel: "Garder archivé", variant: "danger",
    });
    if (supprimer) {
      const r = await supabase.functions.invoke("admin-user-actions", { body: { action: "delete", user_id: source } });
      if (r.error || (r.data as any)?.error) toast.error((r.data as any)?.error ?? r.error?.message ?? "Suppression impossible");
      else toast.success("Ancien compte supprimé");
    }
    onDone();
    onClose();
  };

  const sel = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h4 className="flex items-center gap-2 text-[17px] font-bold text-slate-900"><GitMerge size={18} /> Fusionner deux comptes</h4>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un e-mail ou un nom…" className={`${sel} mt-3`} />
        <label className="mt-3 block text-xs font-semibold text-slate-600">Compte à GARDER
          <select value={garder} onChange={(e) => setGarder(e.target.value)} className={`${sel} mt-1`}>
            <option value="">— choisir —</option>
            {liste.map((u) => <option key={u.user_id} value={u.user_id}>{label(u)}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-xs font-semibold text-slate-600">Compte à FUSIONNER dedans (ses données sont déplacées)
          <select value={source} onChange={(e) => setSource(e.target.value)} className={`${sel} mt-1`}>
            <option value="">— choisir —</option>
            {liste.filter((u) => u.user_id !== garder).map((u) => <option key={u.user_id} value={u.user_id}>{label(u)}</option>)}
          </select>
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Annuler</button>
          <button type="button" disabled={busy || !garder || !source} onClick={fusionner}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2F5FFF] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}Fusionner
          </button>
        </div>
      </div>
    </div>
  );
}
