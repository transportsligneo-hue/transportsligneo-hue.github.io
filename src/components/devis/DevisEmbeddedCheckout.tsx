import { useCallback } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe-client";

interface Props {
  devisId?: string;
  /** Token public du devis (paiement sans connexion). */
  token?: string;
  returnUrl: string;
}

export function DevisEmbeddedCheckout({ devisId, token, returnUrl }: Props) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/devis/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devisId, token, returnUrl, environment: getStripeEnvironment() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Échec création session de paiement");
    }
    const data = await res.json();
    if (!data?.clientSecret) throw new Error("clientSecret manquant");
    return data.clientSecret as string;
  }, [devisId, token, returnUrl]);


  return (
    <div id="devis-checkout" className="rounded-xl border border-cream/10 bg-white p-2 shadow-sm">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
