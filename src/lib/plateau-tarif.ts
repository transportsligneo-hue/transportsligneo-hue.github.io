// Convoyage sur plateau (camion plateau, véhicule non roulé : 0 km au compteur).
// Prix TTC client = relevés concurrent du 28/10/2026 (départ Tours, HT) × 1,20 × 0,95
// (5 % sous le concurrent). Même prix en micro et en société (TTC client).
// Désactivé par défaut : l'admin l'active dans Paramètres (réglage « plateau_enabled »).
import { vehicleCoef } from "@/lib/vehicle-price-coef";

/** [km, prix HT du concurrent] — interpolation linéaire entre deux points. */
const POINTS: Array<[number, number]> = [
  [0, 530],
  [240, 530],
  [345, 760],
  [478, 940],
  [559, 1285],
  [717, 1350],
  [786, 1480],
  [835, 1590],
  [954, 1908],
];
const RATE_HT_AU_DELA = 2.0; // €/km HT au-delà du dernier point

function concurrentHt(d: number): number {
  const last = POINTS[POINTS.length - 1];
  if (d >= last[0]) return last[1] + (d - last[0]) * RATE_HT_AU_DELA;
  for (let i = 1; i < POINTS.length; i++) {
    const [x1, y1] = POINTS[i];
    if (d <= x1) {
      const [x0, y0] = POINTS[i - 1];
      return y0 + ((y1 - y0) * (d - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

/** Prix TTC plateau pour une distance (km) et un type de véhicule. Utilitaire : +20 % (relevé concurrent). */
export function plateauPrice(d: number, vehicleType?: string | null): number {
  const util = (vehicleType ?? "").toLowerCase() === "utilitaire";
  const coef = util ? 1.2 : vehicleCoef(vehicleType);
  return Math.round(concurrentHt(d) * 1.2 * 0.95 * coef);
}
