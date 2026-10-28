/**
 * Coefficient de prix selon le type de véhicule (base = citadine).
 * Même tarif pour citadine, berline, break, SUV/4x4, monospace et autre.
 * Luxe et sport (luxe/supercar, coupé, cabriolet) : +5 %.
 * Utilitaire (jusqu'à 15 m³) : +10 %.
 */
const COEF: Record<string, number> = {
  luxe: 1.05,
  coupe: 1.05,
  cabriolet: 1.05,
  utilitaire: 1.1,
};

export function vehicleCoef(type?: string | null): number {
  return COEF[(type ?? "").toLowerCase()] ?? 1;
}

export function applyVehicleCoef(price: number, type?: string | null): number {
  return Math.round(price * vehicleCoef(type));
}
