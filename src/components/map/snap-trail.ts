/**
 * Trace « façon Uber » : les positions GPS (espacées) sont recalées sur le réseau routier
 * (Mapbox Map Matching, sinon OSRM /match) pour suivre les rues au lieu de tracer des
 * lignes droites entre deux points. En cas d'échec, on garde les points bruts.
 */
import { useEffect, useRef, useState } from "react";
import { MAPBOX_TOKEN } from "@/lib/mapbox-token";
import type { LiveGpsPoint } from "./types";

type LL = [number, number]; // [lat, lng]
const MAX = 90;

function thin(points: LiveGpsPoint[]): LiveGpsPoint[] {
  // enlève les doublons quasi immobiles puis limite à MAX points
  const out: LiveGpsPoint[] = [];
  for (const p of points) {
    const l = out[out.length - 1];
    if (!l || Math.abs(l.latitude - p.latitude) + Math.abs(l.longitude - p.longitude) > 0.00015) out.push(p);
  }
  if (out.length <= MAX) return out;
  const step = Math.ceil(out.length / MAX);
  const r = out.filter((_, i) => i % step === 0);
  if (r[r.length - 1] !== out[out.length - 1]) r.push(out[out.length - 1]);
  return r.slice(-MAX);
}

async function match(points: LiveGpsPoint[]): Promise<LL[] | null> {
  const pts = thin(points);
  if (pts.length < 2) return null;
  const coords = pts.map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join(";");
  const radiuses = pts.map(() => 40).join(";");
  const urls: string[] = [];
  if (MAPBOX_TOKEN) {
    urls.push(
      `https://api.mapbox.com/matching/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&tidy=true&radiuses=${radiuses}&access_token=${MAPBOX_TOKEN}`,
    );
  }
  urls.push(`https://router.project-osrm.org/match/v1/driving/${coords}?overview=full&geometries=geojson&radiuses=${radiuses}`);
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const d = await r.json();
      const lines: [number, number][][] = (d?.matchings ?? []).map(
        (m: { geometry?: { coordinates?: [number, number][] } }) => m.geometry?.coordinates ?? [],
      );
      const flat = lines.flat();
      if (flat.length >= 2) return flat.map(([lng, lat]) => [lat, lng] as LL);
    } catch {
      /* essaie la source suivante */
    }
  }
  return null;
}

/** Renvoie la trace recalée sur les routes ; points bruts tant que le calcul n'est pas prêt. */
export function useSnappedTrail(points: LiveGpsPoint[]): LL[] {
  const raw: LL[] = points.map((p) => [p.latitude, p.longitude]);
  const [snapped, setSnapped] = useState<{ n: number; line: LL[] } | null>(null);
  const lastN = useRef(0);

  useEffect(() => {
    if (points.length < 2) {
      setSnapped(null);
      lastN.current = 0;
      return;
    }
    // Recalcul seulement toutes les 3 nouvelles positions (limite les appels).
    if (points.length - lastN.current < 3 && snapped) return;
    lastN.current = points.length;
    let dead = false;
    match(points).then((line) => {
      if (!dead && line) setSnapped({ n: points.length, line });
    });
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);

  if (!snapped) return raw;
  // Prolonge jusqu'à la toute dernière position reçue (si plus récente que le calcul).
  const tail = points.length > snapped.n ? raw.slice(snapped.n - 1) : [];
  return tail.length ? [...snapped.line, ...tail] : snapped.line;
}
