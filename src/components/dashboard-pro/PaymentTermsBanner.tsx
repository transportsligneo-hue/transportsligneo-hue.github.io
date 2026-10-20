import { useQuery } from "@tanstack/react-query";
import { CreditCard, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import { resolvePaymentTerms, paymentTermsLabel } from "@/lib/payment-terms";

/** Bandeau : conditions de paiement du compte (tolère l'absence de la colonne). */
export function PaymentTermsBanner() {
  const { data: org } = useCurrentOrgAccountType();
  const { data: stored } = useQuery({
    queryKey: ["org-payment-terms", org?.orgId],
    enabled: !!org?.orgId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("conditions_paiement" as never).eq("id", org!.orgId as string).maybeSingle();
      if (error) return null;
      return ((data as unknown as { conditions_paiement?: string | null } | null)?.conditions_paiement) ?? null;
    },
  });
  if (!org?.orgId) return null;
  const t = paymentTermsLabel(resolvePaymentTerms(stored, org.accountType));
  const Icon = t.key === "carte" ? CreditCard : FileText;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#e7ebf3] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(20,22,28,0.04)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--pro-accent)]/10 text-[color:var(--pro-accent)]"><Icon size={17} /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a3a4ac]">Vos conditions de paiement</p>
        <p className="text-[14px] font-semibold text-[#14161c]">{t.short}</p>
      </div>
    </div>
  );
}
