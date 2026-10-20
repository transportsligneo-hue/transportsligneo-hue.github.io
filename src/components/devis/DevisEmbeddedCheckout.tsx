import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe-client";

interface Props {
  devisId?: string;
  /** Token public du devis (paiement sans connexion). */
  token?: string;
  returnUrl: string;
}

export function DevisEmbeddedCheckout({ devisId, token, returnUrl }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setClientSecret(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/devis/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ devisId, token, returnUrl, environment: getStripeEnvironment() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = [data?.error, data?.detail].filter(Boolean).join(" — ") || "Échec création session de paiement";
          throw new Error(`[${res.status}] ${msg}`);
        }
        if (!data?.clientSecret) throw new Error("clientSecret manquant");
        if (!cancelled) setClientSecret(data.clientSecret as string);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    })();
    return () => { cancelled = true; };
  }, [devisId, token, returnUrl]);

  if (error) {
    return (
      <div id="devis-checkout" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">Le paiement n'a pas pu démarrer.</p>
        <p className="mt-1 break-words">{error}</p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div id="devis-checkout" className="rounded-xl border border-cream/10 bg-white p-6 text-center text-sm text-slate-600">
        Préparation du paiement…
      </div>
    );
  }

  return (
    <div id="devis-checkout" className="rounded-xl border border-cream/10 bg-white p-2 shadow-sm">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
