// Résolution robuste de la distance routière entre deux adresses libres,
// utilisée par TOUS les formulaires de commande (particulier, pro, flotte, B2B).
// Ordre : table locale → Google → géocodage mondial (Photon/OSM) + itinéraire
// routier, avec repli vol d'oiseau majoré. Fonctionne en France, en Europe et
// hors d'Europe.

import { getDistance } from "./reservation-pricing";
import { geocodeDistanceKm } from "./distance-fallback";
import { getGoogleDistanceKm, isGoogleAvailable } from "./google-places";

const cache = new Map<string, number | null>();

export async function resolveDistanceKm(from: string, to: string): Promise<number | null> {
  const a = (from ?? "").trim();
  const b = (to ?? "").trim();
  if (a.length < 2 || b.length < 2) return null;
  const key = `${a.toLowerCase()}||${b.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;

  let km: number | null = getDistance(a, b);
  if (km == null && isGoogleAvailable()) {
    try { km = await getGoogleDistanceKm(a, b); } catch { km = null; }
  }
  if (km == null) {
    try { km = await geocodeDistanceKm(a, b); } catch { km = null; }
  }
  if (km != null) cache.set(key, km);
  return km;
}
