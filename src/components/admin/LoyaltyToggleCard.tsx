import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlag, featureFlagQueryKey } from "@/hooks/useFeatureFlag";

/** Interrupteur global du Compte Kilomètres : masque la rubrique partout sans toucher aux soldes. */
export function LoyaltyToggleCard() {
  const enabled = useFeatureFlag("compte_kilometres");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("feature_flags")
      .upsert({ key: "compte_kilometres", enabled: !enabled, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error("Modification impossible");
    await qc.invalidateQueries({ queryKey: featureFlagQueryKey("compte_kilometres") });
    toast.success(!enabled ? "Compte Kilomètres affiché pour tous les comptes" : "Compte Kilomètres masqué pour tous les comptes");
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-pro-border bg-pro-surface p-5">
      <div className="flex items-start gap-3">
        <Gauge size={20} className="mt-0.5 text-pro-accent" />
        <div>
          <p className="font-semibold text-pro-text">Compte Kilomètres</p>
          <p className="text-sm text-pro-muted">
            {enabled
              ? "Visible dans tous les espaces clients, professionnels et flotte."
              : "Masqué partout. Les kilomètres et avoirs déjà cumulés sont conservés."}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Activer le Compte Kilomètres"
        disabled={busy}
        onClick={() => void toggle()}
        className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? "bg-[#2f5fff]" : "bg-slate-300"} disabled:opacity-60`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
