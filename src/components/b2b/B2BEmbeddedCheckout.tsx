import { useCallback } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe-client";

interface Props {
  requestId: string;
  returnUrl: string;
}

export function B2BEmbeddedCheckout({ requestId, returnUrl }: Props) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/b2b/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, returnUrl, environment: getStripeEnvironment() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Échec création session de paiement");
    }
    const data = await res.json();
    if (!data?.clientSecret) throw new Error("clientSecret manquant");
    return data.clientSecret as string;
  }, [requestId, returnUrl]);

  return (
    <div id="b2b-checkout" className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
