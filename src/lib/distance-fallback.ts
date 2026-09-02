// Distance de secours : géocodage réel des deux adresses puis distance
// à vol d'oiseau majorée d'un facteur routier. Utilisé quand la table locale
// ville-à-ville et Google Distance Matrix ne donnent rien (ex : trajet
// intra-ville comme Blois → Blois sur deux adresses différentes).

import { geocodeAddress, haversineKm } from "./geocode";

/** Facteur de sinuosité route/vol d'oiseau (moyenne réseau français). */
const ROAD_FACTOR = 1.3;

export function normalizeAddress(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Distance routière estimée en km entre deux adresses libres.
 * Renvoie 0 uniquement si les deux adresses sont strictement identiques.
 */
export async function geocodeDistanceKm(
  from: string,
  to: string,
): Promise<number | null> {
  const a = (from ?? "").trim();
  const b = (to ?? "").trim();
  if (!a || !b) return null;
  if (normalizeAddress(a) === normalizeAddress(b)) return 0;
  const [pa, pb] = await Promise.all([geocodeAddress(a), geocodeAddress(b)]);
  if (!pa || !pb) return null;
  const km = haversineKm(pa, pb) * ROAD_FACTOR;
  if (!Number.isFinite(km)) return null;
  // Trajet court réel : on garde au minimum 1 km (jamais 0 si adresses ≠)
  return Math.max(1, Math.round(km));
}
