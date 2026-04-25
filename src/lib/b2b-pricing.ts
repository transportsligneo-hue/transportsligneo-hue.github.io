// Tarification B2B transport ponctuel
// Logique: distance × tarif/km + suppléments (type véhicule, urgence, non roulant)

import { getDistance } from "./reservation-pricing";

export type B2BVehicleType = "leger" | "utilitaire" | "premium" | "electrique";
export type B2BUrgency = "immediat" | "aujourdhui" | "planifie";

const RATE_PER_KM_SHORT = 1.30; // < 200 km
const RATE_PER_KM_LONG = 0.95;  // ≥ 200 km

const VEHICLE_MULTIPLIER: Record<B2BVehicleType, number> = {
  leger: 1.0,
  utilitaire: 1.20,
  premium: 1.30,
  electrique: 1.10,
};

const URGENCY_MULTIPLIER: Record<B2BUrgency, number> = {
  immediat: 1.30,
  aujourdhui: 1.15,
  planifie: 1.0,
};

const NON_RUNNING_SURCHARGE = 1.40; // +40% si non roulant
const MIN_PRICE_HT = 89; // minimum facturable HT
const VAT_RATE = 0.20;

export interface B2BEstimateInput {
  pickup: string;
  dropoff: string;
  vehicleType: B2BVehicleType;
  vehicleRunning: boolean;
  urgency: B2BUrgency;
}

export interface B2BEstimate {
  distanceKm: number | null;
  basePerKm: number;
  priceHt: number;
  vat: number;
  priceTtc: number;
  breakdown: string[];
  isEstimable: boolean;
}

export function estimateB2BPrice(input: B2BEstimateInput): B2BEstimate {
  const distance = getDistance(input.pickup, input.dropoff);
  const breakdown: string[] = [];

  if (distance == null || distance === 0) {
    return {
      distanceKm: null,
      basePerKm: 0,
      priceHt: 0,
      vat: 0,
      priceTtc: 0,
      breakdown: ["Distance non calculable automatiquement — devis manuel requis"],
      isEstimable: false,
    };
  }

  const rate = distance < 200 ? RATE_PER_KM_SHORT : RATE_PER_KM_LONG;
  let base = distance * rate;
  breakdown.push(`${distance} km × ${rate.toFixed(2)} €/km = ${base.toFixed(2)} €`);

  const vMult = VEHICLE_MULTIPLIER[input.vehicleType];
  if (vMult !== 1) {
    base = base * vMult;
    breakdown.push(`Type véhicule ${input.vehicleType} (×${vMult})`);
  }

  const uMult = URGENCY_MULTIPLIER[input.urgency];
  if (uMult !== 1) {
    base = base * uMult;
    breakdown.push(`Urgence ${input.urgency} (×${uMult})`);
  }

  if (!input.vehicleRunning) {
    base = base * NON_RUNNING_SURCHARGE;
    breakdown.push(`Véhicule non roulant (×${NON_RUNNING_SURCHARGE})`);
  }

  const priceHt = Math.max(Math.round(base), MIN_PRICE_HT);
  if (priceHt === MIN_PRICE_HT && Math.round(base) < MIN_PRICE_HT) {
    breakdown.push(`Forfait minimum appliqué : ${MIN_PRICE_HT} € HT`);
  }
  const vat = Math.round(priceHt * VAT_RATE * 100) / 100;
  const priceTtc = Math.round((priceHt + vat) * 100) / 100;

  return {
    distanceKm: distance,
    basePerKm: rate,
    priceHt,
    vat,
    priceTtc,
    breakdown,
    isEstimable: true,
  };
}

export const B2B_VEHICLE_LABELS: Record<B2BVehicleType, string> = {
  leger: "Véhicule léger",
  utilitaire: "Utilitaire",
  premium: "Premium / Haut de gamme",
  electrique: "Électrique",
};

export const B2B_URGENCY_LABELS: Record<B2BUrgency, string> = {
  immediat: "Immédiat (sous 4h)",
  aujourdhui: "Aujourd'hui",
  planifie: "Planifié",
};

// Scoring lead flotte (côté client pour preview)
export function calculateLeadScore(input: {
  vehicleCount: number;
  companySize?: string;
  startDelay?: string;
  budget?: string;
}): { score: number; category: "hot" | "warm" | "cold" } {
  let score = 0;
  if (input.vehicleCount > 50) score += 80;
  else if (input.vehicleCount > 10) score += 50;
  if (input.companySize === "51-250" || input.companySize === "250+") score += 30;
  if (input.startDelay === "immediat") score += 30;
  if (input.budget && input.budget.trim().length > 0) score += 20;
  if (score > 100) score = 100;
  const category = score >= 80 ? "hot" : score >= 40 ? "warm" : "cold";
  return { score, category };
}
