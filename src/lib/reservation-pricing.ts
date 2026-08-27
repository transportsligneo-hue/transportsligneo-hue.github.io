// Tarification réutilisée du DevisGenerator (cohérence avec les tarifs existants)

const CITY_DISTANCES: Record<string, Record<string, number>> = {
  Tours: { Paris: 237, Lyon: 477, Marseille: 700, Bordeaux: 350, Nantes: 218, Lille: 460, Strasbourg: 620, Toulouse: 530, Nice: 840, Montpellier: 640, Rennes: 300, "Orléans": 117, Poitiers: 100, Limoges: 220, "Clermont-Ferrand": 335, Angers: 110, "Le Mans": 82, Blois: 60, Chartres: 140, Rouen: 310, Caen: 320, Dijon: 400, Reims: 380, Metz: 520, Nancy: 500, Brest: 530, "La Rochelle": 230, Perpignan: 750, Grenoble: 540, "Saint-Étienne": 430, Amiens: 390, Bourges: 155, "Châteauroux": 110 },
  Paris: { Lyon: 465, Marseille: 775, Bordeaux: 585, Nantes: 385, Lille: 225, Strasbourg: 490, Toulouse: 680, Nice: 930, Montpellier: 750, Rennes: 350, "Orléans": 130, Poitiers: 340 },
};

const CITY_DEPARTMENTS: Record<string, string> = {
  Tours: "37-intra",
  "Châteauroux": "37-hors",
};

const FIXED_TARIFFS: Record<string, [number, number]> = {
  "37-intra": [70, 120],
  "37-hors": [90, 130],
};

/** Extrait la première ville reconnue d'une adresse libre */
function extractCity(address: string): string {
  if (!address) return "";
  // Cherche une ville connue dans l'adresse
  const cities = [...new Set([...Object.keys(CITY_DISTANCES), ...Object.keys(CITY_DEPARTMENTS), ...Object.values(CITY_DISTANCES).flatMap(v => Object.keys(v))])];
  for (const city of cities) {
    if (address.toLowerCase().includes(city.toLowerCase())) return city;
  }
  return "";
}

export function getDistance(from: string, to: string): number | null {
  const cFrom = extractCity(from);
  const cTo = extractCity(to);
  if (!cFrom || !cTo) return null;
  if (cFrom === cTo) return 0;
  if (CITY_DISTANCES[cFrom]?.[cTo]) return CITY_DISTANCES[cFrom][cTo];
  if (CITY_DISTANCES[cTo]?.[cFrom]) return CITY_DISTANCES[cTo][cFrom];
  const dFromTours = CITY_DISTANCES.Tours?.[cFrom] ?? CITY_DISTANCES[cFrom]?.Tours;
  const dToTours = CITY_DISTANCES.Tours?.[cTo] ?? CITY_DISTANCES[cTo]?.Tours;
  if (dFromTours != null && dToTours != null) return Math.round((dFromTours + dToTours) * 0.85);
  return null;
}

export type TripType = "aller_simple" | "aller_retour" | "express";

import { resolveLocalDeptTariff } from "./pricing-departments";

export function calculateBasePrice(
  depart: string,
  arrivee: string,
  type: TripType,
  distOverride?: number | null,
): { base: number; label: string; distance: number | null } {
  // 1) Forfait départemental (CP / agglo) — prioritaire et tolérant aux adresses Google Places
  const optionKey = type === "aller_retour" ? "aller-retour" : type === "express" ? "express" : "aller-simple";
  const local = resolveLocalDeptTariff(depart, arrivee, 0, optionKey);
  if (local) {
    return { base: local.finalPrice, label: local.label, distance: null };
  }

  // 2) Distance : override (Google Distance Matrix) > table locale ville-à-ville
  const dist = distOverride ?? getDistance(depart, arrivee);
  if (dist == null || dist === 0) return { base: 0, label: "Distance non calculée", distance: dist };

  const rate = dist < 200 ? 1.20 : 0.85;
  const rateLabel = dist < 200 ? "1,20 €/km" : "0,85 €/km";
  const baseKm = Math.round(dist * rate);
  let base = baseKm;
  let label = `${dist} km × ${rateLabel}`;
  if (type === "aller_retour") { base = Math.round(baseKm * 1.5); label = `${dist} km × ${rateLabel} (livraison + restitution)`; }
  else if (type === "express") { base = Math.round(baseKm * 1.20); label = `${dist} km × ${rateLabel} (+20% express)`; }
  return { base, label, distance: dist };
}

export interface OptionItem {
  id: string;
  label: string;
  price: number;
}

export const RESERVATION_OPTIONS: OptionItem[] = [
  { id: "lavage_ext", label: "Lavage extérieur", price: 24 },
  { id: "lavage_complet", label: "Lavage intérieur + extérieur", price: 59 },
];

export function calculateOptionsTotal(selectedIds: string[]): number {
  return selectedIds.reduce((sum, id) => {
    const opt = RESERVATION_OPTIONS.find(o => o.id === id);
    return sum + (opt?.price ?? 0);
  }, 0);
}
