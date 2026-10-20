import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PAYMENT_TERMS, resolvePaymentTerms, defaultPaymentTerms, type PaymentTerms } from "@/lib/payment-terms";

/** Réglage admin : conditions de paiement d'un compte pro (défaut selon le type de compte). */
export function OrgPaymentTermsBlock({
  orgId, accountType, value,
}: { orgId: string; accountType: string | null; value: string | null }) {
  const [current, setCurrent] = useState<PaymentTerms>(resolvePaymentTerms(value, accountType));
  const [saving, setSaving] = useState(false);
  const def = defaultPaymentTerms(accountType);

  const save = async (next: PaymentTerms) => {
    const prev = current;
    setCurrent(next);
    setSaving(true);
    const { error } = await supabase.from("organizations").update({ conditions_paiement: next } as never).eq("id", orgId);
    setSaving(false);
    if (error) {
      setCurrent(prev);
      toast.error("Enregistrement impossible. La colonne « conditions_paiement » existe-t-elle dans Supabase ?");
    } else toast.success("Conditions de paiement enregistrées");
  };

  return (
    <div className="rounded-2xl border border-pro-border bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <CreditCard size={16} className="text-[#2f5fff]" />
        <h3 className="text-sm font-semibold text-[#14161c]">Conditions de paiement</h3>
        {saving && <Loader2 size={14} className="animate-spin text-[#a3a4ac]" />}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PAYMENT_TERMS.map((p) => {
          const active = p.key === current;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => save(p.key)}
              className={`rounded-2xl border p-3 text-left transition ${active ? "border-[#2f5fff] bg-[#eaf0ff]" : "border-[#eaeaee] hover:border-[#c9d6ff]"}`}
            >
              <span className="flex items-center justify-between text-[13px] font-semibold text-[#14161c]">
                {p.label}
                {p.key === def && <span className="rounded-full bg-[#f3f4f8] px-2 py-0.5 text-[10.5px] font-medium text-[#70727d]">Par défaut</span>}
              </span>
              <span className="mt-1 block text-[12px] leading-snug text-[#70727d]">{p.desc}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-[#70727d]">
        Flotte : facture à 30 jours par défaut. B2B : carte bancaire par défaut. À adapter selon le volume du client.
      </p>
    </div>
  );
}
