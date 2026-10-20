import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe-client";
import { BANK_DETAILS } from "@/lib/bank-details";

interface Props {
  devisId?: string;
  /** Token public du devis (paiement sans connexion). */
  token?: string;
  returnUrl: string;
  /** Référence du devis et montant, pour le virement de secours. */
  numero?: string;
  montant?: number;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="break-all font-mono text-sm text-slate-900">{value}</div>
      </div>
      <button
        type="button"
        onClick={() => {
          try { void navigator.clipboard.writeText(value); } catch { /* noop */ }
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
      >
        {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}

function BankTransferFallback({ numero, montant }: { numero?: string; montant?: number }) {
  const hasBank = !!BANK_DETAILS.iban.trim();
  return (
    <div id="devis-checkout" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-800">
      <p className="font-semibold">Le paiement par carte est momentanément indisponible.</p>
      {hasBank ? (
        <>
          <p className="mt-1">Réglez par <strong>virement instantané</strong> avec les informations ci-dessous. Indiquez bien la référence : votre devis est validé dès réception.</p>
          <div className="mt-3 space-y-2">
            <CopyRow label="Bénéficiaire" value={BANK_DETAILS.titulaire} />
            <CopyRow label="IBAN" value={BANK_DETAILS.iban} />
            {BANK_DETAILS.bic ? <CopyRow label="BIC" value={BANK_DETAILS.bic} /> : null}
            {typeof montant === "number" && montant > 0 ? <CopyRow label="Montant (TTC)" value={`${montant.toFixed(2)} €`} /> : null}
            {numero ? <CopyRow label="Référence du virement" value={numero} /> : null}
          </div>
        </>
      ) : (
        <p className="mt-1">Appelez-nous au <strong>{BANK_DETAILS.telephone}</strong> pour régler par virement.</p>
      )}
    </div>
  );
}

export function DevisEmbeddedCheckout({ devisId, token, returnUrl, numero, montant }: Props) {
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
      <div className="space-y-3">
        <BankTransferFallback numero={numero} montant={montant} />
        <details className="text-xs text-slate-400">
          <summary>Détail technique</summary>
          <p className="mt-1 break-words">{error}</p>
        </details>
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
