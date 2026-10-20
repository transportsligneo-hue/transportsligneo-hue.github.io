export type PaymentTerms = "carte" | "virement_reception" | "facture_15" | "facture_30";

export const PAYMENT_TERMS: { key: PaymentTerms; label: string; short: string; desc: string }[] = [
  { key: "carte", label: "Carte bancaire", short: "Paiement par carte", desc: "Le client paie en ligne au moment de la réservation." },
  { key: "virement_reception", label: "Virement à réception", short: "Paiement à réception de la facture", desc: "Facture envoyée après la mission, à régler à réception." },
  { key: "facture_15", label: "Facture à 15 jours", short: "Facture à 15 jours", desc: "Facture envoyée après la mission, règlement sous 15 jours." },
  { key: "facture_30", label: "Facture à 30 jours", short: "Facture à 30 jours", desc: "Facture (mensuelle) envoyée après la mission, règlement sous 30 jours." },
];

/** Valeur par défaut selon le type de compte : Flotte = facture 30 j, B2B = carte. */
export function defaultPaymentTerms(accountType: string | null | undefined): PaymentTerms {
  return accountType === "flotte" ? "facture_30" : "carte";
}

export function resolvePaymentTerms(value: string | null | undefined, accountType: string | null | undefined): PaymentTerms {
  return (PAYMENT_TERMS.some((p) => p.key === value) ? value : defaultPaymentTerms(accountType)) as PaymentTerms;
}

export const paymentTermsLabel = (k: PaymentTerms) => PAYMENT_TERMS.find((p) => p.key === k)!;
