/**
 * Prochaine étape clé du trajet : passage de frontière (trajets internationaux)
 * ou prochaine pause conducteur recommandée (trajets longs).
 *
 * Un seul repère est renvoyé à la fois. Les pays sont détectés par géocodage
 * inverse Mapbox sur quelques points échantillonnés du parcours restant,
 * avec cache mémoire pour limiter les appels.
 */
import { haversineKm } from "@/lib/geo/haversine";

export interface NextMilestone {
  kind: "frontiere" | "pause";
  label: string;
  /** Minutes estimées avant l'étape (null si non estimable). */
  inMinutes: number | null;
}

const COUNTRY_NAMES: Record<string, string> = {
  fr: "France",
  es: "Espagne",
  pt: "Portugal",
  it: "Italie",
  de: "Allemagne",
  be: "Belgique",
  nl: "Pays-Bas",
  lu: "Luxembourg",
  ch: "Suisse",
  at: "Autriche",
  gb: "Royaume-Uni",
  ie: "Irlande",
  pl: "Pologne",
  cz: "Tchéquie",
  dk: "Danemark",
  ad: "Andorre",
  mc: "Monaco",
};

const cache = new Map<string, string | null>();

async function countryAt(lat: number, lng: number, token: string): Promise<string | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const r = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country&limit=1&access_token=${token}`,
    );
    if (!r.ok) throw new Error("geocode failed");
    const d = await r.json();
    const code = (d?.features?.[0]?.properties?.short_code as string | undefined)?.toLowerCase() ?? null;
    cache.set(key, code);
    return code;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Pause conseillée toutes les 2 h de conduite continue. */
const PAUSE_EVERY_MIN = 120;

export async function computeNextMilestone(opts: {
  route: Array<[number, number]>;
  /** Index du point courant sur l'itinéraire. */
  index: number;
  remainingKm: number;
  speedKmh: number;
  token: string | null;
  drivingSinceLastStopMin: number | null;
}): Promise<NextMilestone | null> {
  const { route, index, remainingKm, speedKmh, token, drivingSinceLastStopMin } = opts;
  const refSpeed = speedKmh > 15 && speedKmh < 160 ? speedKmh : 75;

  // 1) Frontière à venir
  if (token && route.length > 2 && remainingKm > 25) {
    const ahead = route.slice(index);
    const samples = 8;
    const step = Math.max(1, Math.floor(ahead.length / samples));
    const current = ahead[0];
    const currentCountry = await countryAt(current[0], current[1], token);
    if (currentCountry) {
      let cum = 0;
      let prev = current;
      for (let i = step; i < ahead.length; i += step) {
        const p = ahead[i];
        for (let j = Math.max(1, i - step + 1); j <= i; j++) {
          cum += haversineKm(
            { lat: ahead[j - 1][0], lng: ahead[j - 1][1] },
            { lat: ahead[j][0], lng: ahead[j][1] },
          );
        }
        prev = p;
        const c = await countryAt(p[0], p[1], token);
        if (c && c !== currentCountry) {
          const name = COUNTRY_NAMES[c] ?? c.toUpperCase();
          return {
            kind: "frontiere",
            label: `Passage frontière ${name}`,
            inMinutes: Math.max(1, Math.round((cum / refSpeed) * 60)),
          };
        }
      }
      void prev;
    }
  }

  // 2) Prochaine pause conducteur recommandée (trajets longs)
  if (drivingSinceLastStopMin != null && remainingKm > 60) {
    const inMin = Math.max(0, PAUSE_EVERY_MIN - drivingSinceLastStopMin);
    if (drivingSinceLastStopMin >= 60) {
      return {
        kind: "pause",
        label: inMin <= 0 ? "Pause conducteur recommandée maintenant" : "Pause conducteur recommandée",
        inMinutes: inMin <= 0 ? 0 : inMin,
      };
    }
  }

  return null;
}
