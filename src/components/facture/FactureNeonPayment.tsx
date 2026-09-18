import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe-client";
import { Loader2, Lock, ShieldCheck, CreditCard, Wallet } from "lucide-react";

export interface FactureSummary {
  numero: string;
  numeroMission?: string | null;
  vehicule?: string | null;
  immatriculation?: string | null;
  dateMission?: string | null;
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
  theme: "stripe",
  variables: {
    colorPrimary: "#2f5fff",
    colorBackground: "#ffffff",
    colorText: "#0b1230",
    colorTextPlaceholder: "#8892ab",
    borderRadius: "12px",
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif",
    fontSizeBase: "14px",
  },
  rules: {
    ".Input": {
      border: "1.5px solid #e6e9f2",
      padding: "14px 16px",
      backgroundColor: "#fbfcfe",
    },
    ".Input:focus": {
      border: "1.5px solid #2f5fff",
      boxShadow: "0 0 0 3px rgba(47,95,255,0.15)",
    },
    ".Label": {
      color: "#3a4260",
      fontWeight: "600",
      fontSize: "12.5px",
    },
    ".Tab": {
      border: "1.5px solid #e6e9f2",
      backgroundColor: "#ffffff",
    },
    ".Tab--selected": {
      border: "1.5px solid #2f5fff",
      backgroundColor: "#f2f5ff",
      boxShadow: "0 6px 16px rgba(47,95,255,0.12)",
    },
  },
};

function RevolutButton({ factureId, amount }: { factureId: string; amount: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/facture/revolut-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factureId, environment: getStripeEnvironment() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.checkoutUrl) {
        setError(data?.error ?? "Revolut Pay indisponible pour le moment.");
        setLoading(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Connexion à Revolut impossible.");
      setLoading(false);
    }
  };

  return (
    <div className="pn-form">
      <p className="pn-revolut-note">
        Vous allez être redirigé vers la page sécurisée Revolut Pay pour régler votre facture.
        Le règlement est confirmé automatiquement dès l'encaissement.
      </p>
      {error && <p className="pn-error">{error}</p>}
      <button type="button" className="pn-btn-pay" onClick={start} disabled={loading}>
        {loading ? (
          <>
            <Loader2 size={17} className="animate-spin" /> Ouverture de Revolut…
          </>
        ) : (
          <>
            <Lock size={16} /> Payer {amount.toFixed(2)} € avec Revolut Pay
          </>
        )}
      </button>
      <p className="pn-secure-note">
        <ShieldCheck size={14} /> Paiement traité par <b>Revolut</b> — aucune donnée bancaire n'est stockée
        par Transports Ligneo.
      </p>
    </div>
  );
}

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
        <div>
          <h2>Paiement sécurisé</h2>
          <p>Carte bancaire, Apple&nbsp;Pay, Google&nbsp;Pay ou prélèvement SEPA.</p>
        </div>
        <div className="pn-amount-chip">
          <div className="lbl">Montant TTC</div>
          <div className="val">{summary.prixTtc.toFixed(2)} €</div>
        </div>
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
  const [method, setMethod] = useState<"card" | "revolut">("card");

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
    <div className="pn-methods-wrap">
      <div className="pn-methods" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={method === "card"}
          className={`pn-method ${method === "card" ? "is-active" : ""}`}
          onClick={() => setMethod("card")}
        >
          <CreditCard size={16} /> Carte bancaire
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === "revolut"}
          className={`pn-method ${method === "revolut" ? "is-active" : ""}`}
          onClick={() => setMethod("revolut")}
        >
          <Wallet size={16} /> Revolut Pay
        </button>
      </div>

      {method === "card" ? (
        <Elements stripe={getStripe()} options={{ clientSecret, appearance: neonAppearance, locale: "fr" }}>
          <PayForm summary={summary} returnUrl={returnUrl} />
        </Elements>
      ) : (
        <RevolutButton factureId={factureId} amount={summary.prixTtc} />
      )}
    </div>
  );
}
