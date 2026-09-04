/**
 * NonRoulantToggle · marque une mission comme « véhicule non roulant / plateau ».
 *
 * Quand la case est cochée, l'app convoyeur bascule sur le parcours EDL
 * simplifié (bon de prise en charge) au lieu de l'état des lieux roulant.
 */
import { useEffect, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function NonRoulantToggle({ trajetId }: { trajetId: string }) {
  const [value, setValue] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("trajets")
      .select("non_roulant")
      .eq("id", trajetId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setValue(!!(data as { non_roulant?: boolean } | null)?.non_roulant);
      });
    return () => { cancelled = true; };
  }, [trajetId]);

  const toggle = async () => {
    if (value === null) return;
    setBusy(true);
    const next = !value;
    const { error } = await supabase.from("trajets").update({ non_roulant: next } as never).eq("id", trajetId);
    setBusy(false);
    if (error) {
      toast.error("Mise à jour impossible", { description: error.message });
      return;
    }
    setValue(next);
    toast.success(next ? "Mission marquée non roulante (plateau)" : "Mission repassée en véhicule roulant");
  };

  return (
    <div className="a6-card p-4">
      <button
        type="button"
        onClick={() => void toggle()}
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
            <Truck size={14} /> Véhicule non roulant (transport sur plateau)
          </span>
          <span className="mt-0.5 block text-[11.5px] text-black/55">
            Active le bon de prise en charge simplifié côté convoyeur et impose la signature du devis à l'enlèvement.
          </span>
        </span>
        {busy && <Loader2 size={14} className="animate-spin" />}
      </button>
    </div>
  );
}
