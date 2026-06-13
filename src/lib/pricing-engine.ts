// Moteur de pricing unifié — utilisé partout (B2C, B2B, admin)
// Wrap les logiques existantes pour produire un breakdown structuré et stockable.

import {
  calculateBasePrice,
  calculateOptionsTotal,
  getDistance,
  RESERVATION_OPTIONS,
  type TripType,
} from "./reservation-pricing";
import {
  estimateB2BPrice,
  type B2BVehicleType,
  type B2BUrgency,
} from "./b2b-pricing";

export type PricingChannel = "b2c" | "b2b";

export interface PricingLine {
  label: string;
  amount?: number; // Optionnel si c'est juste descriptif (multiplicateur)
}

export interface UnifiedQuote {
  channel: PricingChannel;
  distanceKm: number | null;
  priceHt: number;
  vat: number;
  priceTtc: number;
  vatRate: number;
  isEstimable: boolean;
  lines: PricingLine[];
  // Méta non-prix utiles pour l'affichage
  meta: {
    depart: string;
    arrivee: string;
    label?: string;
    extra?: Record<string, string | number | boolean | null | undefined>;
  };
}

const VAT_RATE = 0.20;

export interface B2CQuoteInput {
  depart: string;
  arrivee: string;
  type: TripType;
  optionIds?: string[];
}

export function quoteB2C(input: B2CQuoteInput): UnifiedQuote {
  const { base, label } = calculateBasePrice(input.depart, input.arrivee, input.type);
  const optionsTotal = calculateOptionsTotal(input.optionIds ?? []);
  const distance = getDistance(input.depart, input.arrivee);

  const lines: PricingLine[] = [];
  if (base > 0) lines.push({ label, amount: base });
  (input.optionIds ?? []).forEach((id) => {
    const opt = RESERVATION_OPTIONS.find((o) => o.id === id);
    if (opt) lines.push({ label: opt.label, amount: opt.price });
  });

  // Les grilles publiques (forfaits dept + tarifs km) sont exprimées en TTC client.
  // On rétro-calcule le HT depuis le TTC pour garantir la cohérence avec
  // resolve_client_pricing_rule (qui retourne lui aussi du TTC) et avec les
  // prix affichés sur le site (79 € agglo, 99 € hors agglo, etc.).
  const priceTtc = Math.round((base + optionsTotal) * 100) / 100;
  const priceHt = Math.round((priceTtc / (1 + VAT_RATE)) * 100) / 100;
  const vat = Math.round((priceTtc - priceHt) * 100) / 100;

  return {
    channel: "b2c",
    distanceKm: distance,
    priceHt,
    vat,
    priceTtc,
    vatRate: VAT_RATE,
    isEstimable: priceHt > 0,
    lines,
    meta: { depart: input.depart, arrivee: input.arrivee, label },
  };
}

export interface B2BQuoteInput {
  depart: string;
  arrivee: string;
  vehicleType: B2BVehicleType;
  vehicleRunning: boolean;
  urgency: B2BUrgency;
}

export function quoteB2B(input: B2BQuoteInput): UnifiedQuote {
  const est = estimateB2BPrice({
    pickup: input.depart,
    dropoff: input.arrivee,
    vehicleType: input.vehicleType,
    vehicleRunning: input.vehicleRunning,
    urgency: input.urgency,
  });

  const lines: PricingLine[] = est.breakdown.map((b) => ({ label: b }));

  return {
    channel: "b2b",
    distanceKm: est.distanceKm,
    priceHt: est.priceHt,
    vat: est.vat,
    priceTtc: est.priceTtc,
    vatRate: VAT_RATE,
    isEstimable: est.isEstimable,
    lines,
    meta: { depart: input.depart, arrivee: input.arrivee },
  };
}

/**
 * Auto-quote depuis une demande générique (admin) :
 * essaie B2C par défaut. À utiliser pour pré-remplir l'estimation côté admin.
 */
export function quoteFromDemande(demande: {
  depart: string;
  arrivee: string;
  trip_type?: TripType;
  options?: string | null;
}): UnifiedQuote {
  const optionIds = (demande.options ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return quoteB2C({
    depart: demande.depart,
    arrivee: demande.arrivee,
    type: demande.trip_type ?? "aller_simple",
    optionIds,
  });
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}
