// Lightweight geocoding helpers — uses api-adresse.data.gouv.fr (FR) with
// an OSM Nominatim fallback. No API key required. Results are cached in
// sessionStorage to avoid repeated lookups while a user navigates the app.

export interface GeoPoint {
  lat: number;
  lng: number;
  label?: string;
}

const CACHE_PREFIX = "geocode:v1:";

function readCache(key: string): GeoPoint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as GeoPoint) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: GeoPoint) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore quota / privacy errors
  }
}

async function geocodeFR(address: string): Promise<GeoPoint | null> {
  try {
    const r = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`,
    );
    if (!r.ok) return null;
    const d = await r.json();
    const f = d?.features?.[0];
    if (!f?.geometry?.coordinates) return null;
    const [lng, lat] = f.geometry.coordinates as [number, number];
    return { lat, lng, label: f.properties?.label ?? address };
  } catch {
    return null;
  }
}

async function geocodeOSM(address: string): Promise<GeoPoint | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return null;
    const d = (await r.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const f = d?.[0];
    if (!f) return null;
    return { lat: parseFloat(f.lat), lng: parseFloat(f.lon), label: f.display_name };
  } catch {
    return null;
  }
}

export async function geocodeAddress(address: string | null | undefined): Promise<GeoPoint | null> {
  const q = (address ?? "").trim();
  if (!q) return null;
  const key = q.toLowerCase();
  const cached = readCache(key);
  if (cached) return cached;
  const point = (await geocodeFR(q)) ?? (await geocodeOSM(q));
  if (point) writeCache(key, point);
  return point;
}

/** Haversine distance in km between two points. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export interface GpsPointLite {
  latitude: number;
  longitude: number;
  recorded_at: string;
}

/**
 * Compute a dynamic ETA based on the last GPS samples and the destination.
 * Falls back to a 70 km/h average when speed cannot be estimated.
 */
export function computeEta(
  points: GpsPointLite[],
  destination: { lat: number; lng: number },
): { distanceKm: number; etaMinutes: number; etaAt: Date; avgKmh: number } | null {
  const last = points[points.length - 1];
  if (!last) return null;
  const distanceKm = haversineKm({ lat: last.latitude, lng: last.longitude }, destination);

  // Average speed over the last ~10 samples (≈ 2 min)
  let avgKmh = 70;
  const tail = points.slice(-10);
  if (tail.length >= 2) {
    let dist = 0;
    for (let i = 1; i < tail.length; i++) {
      dist += haversineKm(
        { lat: tail[i - 1].latitude, lng: tail[i - 1].longitude },
        { lat: tail[i].latitude, lng: tail[i].longitude },
      );
    }
    const dtH =
      (new Date(tail[tail.length - 1].recorded_at).getTime() -
        new Date(tail[0].recorded_at).getTime()) /
      3_600_000;
    if (dtH > 0 && dist > 0.05) {
      const speed = dist / dtH;
      if (speed > 5 && speed < 160) avgKmh = speed;
    }
  }
  const etaMinutes = Math.max(1, Math.round((distanceKm / avgKmh) * 60));
  return {
    distanceKm,
    etaMinutes,
    etaAt: new Date(Date.now() + etaMinutes * 60_000),
    avgKmh,
  };
}
