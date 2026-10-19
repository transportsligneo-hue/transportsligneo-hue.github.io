/**
 * Coefficient de prix selon le type de véhicule (base = citadine).
 * Écarts alignés sur le marché : SUV +3 %, utilitaire +9 %.
 * Berline, break, monospace et luxe sont traités comme un SUV (+3 %).
 * Coupé, cabriolet et « autre » : tarif citadine.
 */
const COEF: Record<string, number> = {
  citadine: 1,
  berline: 1.03,
  break: 1.03,
  suv: 1.03,
  monospace: 1.03,
  luxe: 1.03,
  utilitaire: 1.09,
};

export function vehicleCoef(type?: string | null): number {
  return COEF[(type ?? "").toLowerCase()] ?? 1;
}

export function applyVehicleCoef(price: number, type?: string | null): number {
  return Math.round(price * vehicleCoef(type));
}
