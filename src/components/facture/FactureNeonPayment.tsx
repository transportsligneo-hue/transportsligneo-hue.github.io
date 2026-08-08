import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe-client";
import { Loader2, Lock, ShieldCheck, CreditCard } from "lucide-react";

export interface FactureSummary {
  numero: string;
  depart: string | null;
  arrivee: string | null;
  designation: string | null;
  clientEmail: string | null;
  clientNom: string | null;
  clientSociete: string | null;
  prixHt: number;
  prixTva: number;
  prixTtc: number;
  tvaTaux: number;
  referenceClient: string | null;
  referenceLabel: string | null;
}

export const neonAppearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#4f8cff",
    colorBackground: "rgba(255,255,255,0.06)",
    colorText: "#ffffff",
    colorTextPlaceholder: "#7580a3",
    borderRadius: "12px",
    fontFamily: "Inter, sans-serif",
    fontSizeBase: "14px",
  },
  rules: {
    ".Input": {
      border: "1.5px solid rgba(122,163,255,0.22)",
      padding: "14px 16px",
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    ".Input:focus": {
      border: "1.5px solid #4f8cff",
      boxShadow: "0 0 0 3px rgba(79,140,255,0.2), 0 0 16px rgba(79,140,255,0.15)",
    },
    ".Label": {
      color: "#c3cbe8",
      fontWeight: "600",
      fontSize: "12px",
    },
    ".Tab": {
      border: "1.5px solid rgba(122,163,255,0.22)",
      backgroundColor: "rgba(255,255,255,0.04)",
    },
    ".Tab--selected": {
      border: "1.5px solid #4f8cff",
      boxShadow: "0 0 0 1px rgba(79,140,255,0.4), 0 4px 18px rgba(47,95,255,0.35)",
    },
  },
};

function PayForm({ summary, returnUrl }: { summary: FactureSummary; returnUrl: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    if (err) {
      setError(err.message ?? "Le paiement n'a pas pu être confirmé.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="pn-form">
      <div className="pn-pay-header">
        <h2>Paiement sécurisé</h2>
        <p>Carte bancaire, Apple&nbsp;Pay, Google&nbsp;Pay ou prélèvement SEPA.</p>
      </div>

      {summary.clientEmail && (
        <div className="pn-field-group">
          <span className="pn-field-label">Email de facturation</span>
          <div className="pn-static-field">{summary.clientEmail}</div>
        </div>
      )}

      <PaymentElement options={{ layout: "tabs" }} />

      {error && <p className="pn-error">{error}</p>}

      <button type="submit" className="pn-btn-pay" disabled={!stripe || submitting}>
        {submitting ? (
          <>
            <Loader2 size={17} className="animate-spin" />
            Traitement en cours…
          </>
        ) : (
          <>
            <Lock size={16} />
            Payer {summary.prixTtc.toFixed(2)} € TTC
          </>
        )}
      </button>

      <p className="pn-secure-note">
        <ShieldCheck size={14} />
        Paiement chiffré traité par <b>Stripe</b> — aucune donnée bancaire n'est stockée par Transports Ligneo.
      </p>

      <div className="pn-stripe-badge">
        <CreditCard size={13} /> Powered by Stripe · PCI-DSS niveau 1
      </div>
    </form>
  );
}

export function FactureNeonPayment({ factureId, returnUrlBase, onSummary }: { factureId: string; returnUrlBase: string; onSummary?: (s: FactureSummary) => void }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [summary, setSummary] = useState<FactureSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/facture/payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factureId, environment: getStripeEnvironment() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setError(data?.error ?? "Paiement indisponible");
          return;
        }
        setClientSecret(data.clientSecret);
        setSummary(data.summary);
        onSummary?.(data.summary);
      } catch {
        if (alive) setError("Connexion au service de paiement impossible");
      }
    })();
    return () => { alive = false; };
  }, [factureId]);

  const returnUrl = useMemo(() => `${returnUrlBase}?facture=${factureId}`, [returnUrlBase, factureId]);

  if (error) return <div className="pn-panel-state">{error}</div>;
  if (!clientSecret || !summary) {
    return (
      <div className="pn-panel-state">
        <Loader2 className="animate-spin" size={20} />
        Préparation du paiement…
      </div>
    );
  }

  return (
    <Elements stripe={getStripe()} options={{ clientSecret, appearance: neonAppearance, locale: "fr" }}>
      <PayForm summary={summary} returnUrl={returnUrl} />
    </Elements>
  );
}
