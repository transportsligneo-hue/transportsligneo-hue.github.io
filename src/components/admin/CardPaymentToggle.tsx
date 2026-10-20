import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const KEY = "card_payment_disabled";

/**
 * Interrupteur admin : coupe le paiement par carte sur les pages de paiement des devis.
 * Le client voit alors « paiement par carte momentanément indisponible » et ton RIB.
 */
export function CardPaymentToggle() {
  const [disabled, setDisabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
      setDisabled(Boolean((data?.value as { disabled?: boolean } | null)?.disabled));
    })();
  }, []);

  const toggle = async (next: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: KEY, value: { disabled: next } as never }, { onConflict: "key" });
      if (error) throw error;
      setDisabled(next);
      toast.success(next ? "Paiement par carte désactivé : les clients voient ton RIB" : "Paiement par carte réactivé");
    } catch (e) {
      toast.error("Enregistrement impossible", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`mb-4 rounded-xl border p-4 ${disabled ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"} text-slate-900`}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={!!disabled}
          disabled={disabled === null || saving}
          onChange={(e) => void toggle(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold">Désactiver le paiement par carte (virement uniquement)</span>
          <span className="block text-xs text-slate-600">
            Coché : sur les pages de paiement des devis, le client voit « paiement par carte momentanément indisponible »
            avec ton RIB et la référence du devis à indiquer. Décoché : paiement par carte normal.
          </span>
          {disabled ? <span className="mt-1 block text-xs font-semibold text-amber-700">Actuellement : carte désactivée.</span> : null}
        </span>
      </label>
    </div>
  );
}
