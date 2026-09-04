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

  // 1) Vraie distance routière (OSRM) — indispensable pour les longs trajets
  //    et l'international, où le vol d'oiseau sous-estime massivement.
  const road = await osrmRoadKm(pa, pb);
  if (road != null) return Math.max(1, Math.round(road));

  // 2) Secours : vol d'oiseau majoré (facteur plus élevé sur longue distance).
  const straight = haversineKm(pa, pb);
  if (!Number.isFinite(straight)) return null;
  const factor = straight > 300 ? 1.25 : ROAD_FACTOR;
  return Math.max(1, Math.round(straight * factor));
}

async function osrmRoadKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json();
    const meters = d?.routes?.[0]?.distance;
    if (typeof meters !== "number" || !Number.isFinite(meters) || meters <= 0) return null;
    return meters / 1000;
  } catch {
    return null;
  }
}
