/**
 * DechargeRecuperationToggle · active le mandat / décharge de récupération.
 *
 * Quand la case est cochée, un « Mandat de récupération » pré-rempli apparaît
 * dans les documents de la mission (admin, convoyeur, client) et peut être
 * signé sur place ou depuis le téléphone du propriétaire.
 */
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  decharge_recuperation?: boolean | null;
  recuperation_lieu?: string | null;
  recuperation_motif?: string | null;
}

export function DechargeRecuperationToggle({ trajetId }: { trajetId: string }) {
  const [value, setValue] = useState<boolean | null>(null);
  const [lieu, setLieu] = useState("");
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("trajets")
      .select("decharge_recuperation, recuperation_lieu, recuperation_motif")
      .eq("id", trajetId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const r = (data ?? null) as Row | null;
        setValue(!!r?.decharge_recuperation);
        setLieu(r?.recuperation_lieu ?? "");
        setMotif(r?.recuperation_motif ?? "");
      });
    return () => { cancelled = true; };
  }, [trajetId]);

  const save = async (next: boolean, nextLieu = lieu, nextMotif = motif) => {
    setBusy(true);
    const { error } = await supabase
      .from("trajets")
      .update({
        decharge_recuperation: next,
        recuperation_lieu: nextLieu.trim() || null,
        recuperation_motif: nextMotif.trim() || null,
      } as never)
      .eq("id", trajetId);
    setBusy(false);
    if (error) {
      toast.error("Mise à jour impossible", { description: error.message });
      return;
    }
    setValue(next);
    toast.success(next ? "Mandat de récupération activé" : "Mandat de récupération désactivé");
  };

  return (
    <div className="a6-card p-4">
      <button
        type="button"
        onClick={() => void save(!value)}
        disabled={busy || value === null}
        className="flex w-full items-center gap-3 text-left disabled:opacity-60"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md border text-[11px] font-bold ${
            value ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20 text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--a6-text)]">
            <ShieldCheck size={14} /> Décharge / mandat de récupération
          </span>
          <span className="mt-0.5 block text-[11.5px] text-black/55">
            Ajoute un mandat pré-rempli à faire signer par le propriétaire avant la récupération du véhicule.
          </span>
        </span>
        {busy && <Loader2 size={14} className="animate-spin" />}
      </button>

      {value && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            onBlur={() => void save(true)}
            placeholder="Lieu de récupération (garage, fourrière, concession…)"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-[#2F5FFF]"
          />
          <input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            onBlur={() => void save(true)}
            placeholder="Motif (panne, accident, fin de location…)"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-[#2F5FFF]"
          />
        </div>
      )}
    </div>
  );
}
