import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { geocodeAddress } from "@/lib/geocode";
import { haversineKm } from "@/lib/geo/haversine";
import { Minus, Plus, Crosshair, Gauge, Clock, Navigation } from "lucide-react";
import type { LiveMissionMapProps, MapPlace } from "./types";

export const MAPBOX_TOKEN: string =
  (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? "";

const STYLE_URL = "mapbox://styles/mapbox/light-v11";
const BRAND = "#2F5FFF";
const BRAND_DARK = "#1c3fc4";
const GOLD = "#B8862A";
const REST = "#c9d2e3";

const CSS_ID = "ligneo-mapbox-css";
const MAP_CSS = `
.ligneo-mbx .mapboxgl-ctrl-logo{ opacity:.55; transform:scale(.8); transform-origin:left bottom; }
.ligneo-mbx .mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib{ font-size:9px; background:rgba(255,255,255,.75); }
.ligneo-mbx-car{ will-change:transform; }
.ligneo-mbx-car .halo{ position:absolute; inset:-14px; border-radius:50%; background:radial-gradient(circle, rgba(47,95,255,.35) 0%, rgba(47,95,255,0) 70%); animation:ligneo-mbx-halo 2s ease-out infinite; }
@keyframes ligneo-mbx-halo{0%{transform:scale(.6);opacity:.9}70%{transform:scale(1.4);opacity:0}100%{opacity:0}}
`;

const CAR_SVG = `<svg viewBox="0 0 44 44" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lgmbxcar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5b86ff"/><stop offset="100%" stop-color="#1c3fc4"/>
    </linearGradient>
    <filter id="lgmbxsh" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#0b1026" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#lgmbxsh)">
    <circle cx="22" cy="22" r="16" fill="url(#lgmbxcar)" stroke="#fff" stroke-width="3"/>
    <path d="M16 27.4v-3l1.3-4.1a2 2 0 0 1 1.9-1.4h5.6a2 2 0 0 1 1.9 1.4l1.3 4.1v3a1 1 0 0 1-1 1h-1.1a1 1 0 0 1-1-1v-.8h-6.8v.8a1 1 0 0 1-1 1H16.9a1 1 0 0 1-.9-1z" fill="#fff"/>
    <path d="M22 11.6l2.6 3.5h-5.2z" fill="#fff" opacity=".95"/>
  </g>
</svg>`;

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

type LL = { lat: number; lng: number; label?: string };

async function resolvePlace(v: MapPlace): Promise<LL | null> {
  if (!v) return null;
  if (typeof v === "string") {
    // 1) Géocodage Mapbox (précis, même clé publique)
    if (MAPBOX_TOKEN) {
      try {
        const r = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(v)}.json?limit=1&country=fr&language=fr&access_token=${MAPBOX_TOKEN}`,
        );
        if (r.ok) {
          const d = await r.json();
          const c = d?.features?.[0]?.center as [number, number] | undefined;
          if (c) return { lat: c[1], lng: c[0], label: v };
        }
      } catch {
        /* fallback ci-dessous */
      }
    }
    const g = await geocodeAddress(v);
    return g ? { lat: g.lat, lng: g.lng, label: v } : null;
  }
  return v;
}

/** Itinéraire routier réel via Mapbox Directions (fallback OSRM puis ligne directe). */
async function fetchRoute(a: LL, b: LL): Promise<Array<[number, number]>> {
  if (MAPBOX_TOKEN) {
    try {
      const r = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${a.lng},${a.lat};${b.lng},${b.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`,
      );
      if (r.ok) {
        const d = await r.json();
        const coords = d?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
        if (coords?.length) return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
      }
    } catch {
      /* fallback */
    }
  }
  try {
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,
    );
    if (r.ok) {
      const d = await r.json();
      const coords = d?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
      if (coords?.length) return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
    }
  } catch {
    /* fallback */
  }
  return [
    [a.lat, a.lng],
    [b.lat, b.lng],
  ];
}

function lineFeature(coords: Array<[number, number]>): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords.map(([lat, lng]) => [lng, lat]) },
  };
}

function dotEl(color: string, label?: string) {
  const el = document.createElement("div");
  el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.28)`;
  if (label) el.title = label;
  return el;
}

export function MapboxLiveMap({
  points,
  origin,
  destination,
  className = "",
  hideOverlay = false,
  title,
}: LiveMissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const carRef = useRef<mapboxgl.Marker | null>(null);
  const carInnerRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<mapboxgl.Marker | null>(null);
  const endRef = useRef<mapboxgl.Marker | null>(null);
  const animRef = useRef<number | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef(0);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);

  const [places, setPlaces] = useState<{ a: LL | null; b: LL | null }>({ a: null, b: null });
  const [route, setRoute] = useState<Array<[number, number]>>([]);

  const last = points.length ? points[points.length - 1] : null;

  const originKey = typeof origin === "string" ? origin : origin ? `${origin.lat},${origin.lng}` : "";
  const destKey = typeof destination === "string" ? destination : destination ? `${destination.lat},${destination.lng}` : "";

  // ——— Résolution des adresses
  useEffect(() => {
    let dead = false;
    (async () => {
      const [a, b] = await Promise.all([resolvePlace(origin), resolvePlace(destination)]);
      if (!dead) setPlaces({ a, b });
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originKey, destKey]);

  // ——— Itinéraire routier réel
  useEffect(() => {
    let dead = false;
    const a = places.a ?? (points[0] ? { lat: points[0].latitude, lng: points[0].longitude } : null);
    const b = places.b;
    if (!a || !b) {
      setRoute([]);
      return;
    }
    fetchRoute(a, b).then((r) => {
      if (!dead) setRoute(r);
    });
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.a?.lat, places.a?.lng, places.b?.lat, places.b?.lng]);

  // ——— Découpage parcouru / restant + métriques
  const metrics = useMemo(() => {
    if (!route.length) return null;
    const cur = last ? { lat: last.latitude, lng: last.longitude } : { lat: route[0][0], lng: route[0][1] };
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < route.length; i++) {
      const d = haversineKm(cur, { lat: route[i][0], lng: route[i][1] });
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    let total = 0;
    const cum: number[] = [0];
    for (let i = 1; i < route.length; i++) {
      total += haversineKm({ lat: route[i - 1][0], lng: route[i - 1][1] }, { lat: route[i][0], lng: route[i][1] });
      cum.push(total);
    }
    const doneKm = cum[bestIdx];
    const remainingKm = Math.max(0, total - doneKm);
    const progress = total > 0 ? Math.min(100, Math.round((doneKm / total) * 100)) : 0;

    let kmh = 0;
    const tail = points.slice(-8);
    if (tail.length >= 2) {
      let dist = 0;
      for (let i = 1; i < tail.length; i++) {
        dist += haversineKm(
          { lat: tail[i - 1].latitude, lng: tail[i - 1].longitude },
          { lat: tail[i].latitude, lng: tail[i].longitude },
        );
      }
      const dtH =
        (new Date(tail[tail.length - 1].recorded_at).getTime() - new Date(tail[0].recorded_at).getTime()) / 3_600_000;
      if (dtH > 0) kmh = dist / dtH;
    }
    const gpsSpeed = last?.speed != null ? Number(last.speed) * 3.6 : null;
    const speedKmh = gpsSpeed && gpsSpeed > 1 ? gpsSpeed : kmh;
    const refSpeed = speedKmh > 5 && speedKmh < 160 ? speedKmh : 70;
    const etaMin = Math.max(1, Math.round((remainingKm / refSpeed) * 60));

    return {
      done: route.slice(0, bestIdx + 1),
      rest: route.slice(bestIdx),
      remainingKm,
      totalKm: total,
      progress,
      speedKmh,
      etaMin,
      etaAt: new Date(Date.now() + etaMin * 60_000),
    };
  }, [route, points, last]);

  // ——— Montage de la carte (une seule fois)
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;
    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement("style");
      s.id = CSS_ID;
      s.textContent = MAP_CSS;
      document.head.appendChild(s);
    }
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [2.3, 46.8],
      zoom: 4.6,
      attributionControl: true,
      cooperativeGestures: false,
      antialias: true,
    });
    mapRef.current = map;
    map.on("load", () => {
      map.addSource("ligneo-rest", { type: "geojson", data: lineFeature([]) });
      map.addSource("ligneo-done", { type: "geojson", data: lineFeature([]) });
      map.addLayer({
        id: "ligneo-rest-line",
        type: "line",
        source: "ligneo-rest",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": REST, "line-width": 6, "line-opacity": 0.95 },
      });
      map.addLayer({
        id: "ligneo-done-line",
        type: "line",
        source: "ligneo-done",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": BRAND, "line-width": 6 },
      });
      readyRef.current = true;
      setReady(true);
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
      carRef.current = null;
      carInnerRef.current = null;
      startRef.current = null;
      endRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // ——— Marqueurs départ / arrivée
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const { a, b } = places;
    if (a) {
      if (!startRef.current) {
        startRef.current = new mapboxgl.Marker({ element: dotEl(BRAND, a.label ?? "Départ") })
          .setLngLat([a.lng, a.lat])
          .addTo(map);
      } else startRef.current.setLngLat([a.lng, a.lat]);
    }
    if (b) {
      if (!endRef.current) {
        endRef.current = new mapboxgl.Marker({ element: dotEl(GOLD, b.label ?? "Arrivée") })
          .setLngLat([b.lng, b.lat])
          .addTo(map);
      } else endRef.current.setLngLat([b.lng, b.lat]);
    }
  }, [places, ready]);

  // ——— Tracés parcouru / restant + zoom automatique
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !metrics) return;
    (map.getSource("ligneo-rest") as mapboxgl.GeoJSONSource | undefined)?.setData(lineFeature(metrics.rest));
    (map.getSource("ligneo-done") as mapboxgl.GeoJSONSource | undefined)?.setData(lineFeature(metrics.done));

    if (!fittedRef.current && route.length) {
      fittedRef.current = true;
      const b = new mapboxgl.LngLatBounds();
      route.forEach(([lat, lng]) => b.extend([lng, lat]));
      map.fitBounds(b, { padding: 60, duration: 0 });
    }
  }, [metrics, route, ready]);

  // ——— Véhicule : interpolation fluide + rotation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !last) return;
    const target = { lat: last.latitude, lng: last.longitude };
    const prev = points[points.length - 2];
    if (prev) {
      headingRef.current = bearing({ lat: prev.latitude, lng: prev.longitude }, target);
    }

    if (!carRef.current) {
      const wrap = document.createElement("div");
      wrap.className = "ligneo-mbx-car";
      wrap.style.cssText = "position:relative;width:36px;height:36px";
      const halo = document.createElement("span");
      halo.className = "halo";
      const inner = document.createElement("div");
      inner.style.cssText = "transform-origin:center;transition:transform 700ms ease-out";
      inner.innerHTML = CAR_SVG;
      wrap.append(halo, inner);
      carInnerRef.current = inner;
      inner.style.transform = `rotate(${headingRef.current}deg)`;
      carRef.current = new mapboxgl.Marker({ element: wrap }).setLngLat([target.lng, target.lat]).addTo(map);
      posRef.current = target;
      if (!route.length && !fittedRef.current) {
        fittedRef.current = true;
        map.jumpTo({ center: [target.lng, target.lat], zoom: 12 });
      }
      return;
    }

    if (carInnerRef.current) carInnerRef.current.style.transform = `rotate(${headingRef.current}deg)`;
    const from = posRef.current ?? target;
    posRef.current = target;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const t0 = performance.now();
    const dur = 900;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      carRef.current?.setLngLat([from.lng + (target.lng - from.lng) * e, from.lat + (target.lat - from.lat) * e]);
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, [last, points, route.length, ready]);

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (route.length) {
      const b = new mapboxgl.LngLatBounds();
      route.forEach(([lat, lng]) => b.extend([lng, lat]));
      map.fitBounds(b, { padding: 60 });
    } else if (posRef.current) {
      map.easeTo({ center: [posRef.current.lng, posRef.current.lat], zoom: 13 });
    }
  };

  return (
    <div
      className={`ligneo-mbx relative overflow-hidden rounded-2xl ring-1 ring-slate-900/5 ${className}`}
      style={{ minHeight: 260, isolation: "isolate" }}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {/* Contrôles personnalisés */}
      <div className="absolute right-3 top-3 z-[400] flex flex-col gap-1.5">
        {[
          { icon: Plus, fn: () => mapRef.current?.zoomIn(), label: "Zoom avant" },
          { icon: Minus, fn: () => mapRef.current?.zoomOut(), label: "Zoom arrière" },
          { icon: Crosshair, fn: recenter, label: "Recentrer" },
        ].map(({ icon: Icon, fn, label }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            onClick={fn}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/70 bg-white/90 text-slate-700 shadow-lg backdrop-blur transition-colors hover:bg-white"
          >
            <Icon size={15} />
          </button>
        ))}
      </div>

      {/* Badge Live */}
      <div className="absolute left-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-lg backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live{title ? ` · ${title}` : ""}
      </div>

      {/* Carte d'informations flottante */}
      {!hideOverlay && metrics && (
        <div className="absolute bottom-3 left-3 right-3 z-[400] sm:right-auto sm:w-[320px]">
          <div className="rounded-2xl border border-white/70 bg-white/92 p-3.5 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-xl">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Arrivée estimée</p>
                <p className="text-2xl font-extrabold leading-tight text-slate-900 tabular-nums">
                  {metrics.etaAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Restant</p>
                <p className="text-lg font-bold leading-tight tabular-nums" style={{ color: BRAND_DARK }}>
                  {metrics.remainingKm.toFixed(metrics.remainingKm < 10 ? 1 : 0)} km
                </p>
              </div>
            </div>

            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${metrics.progress}%`, background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})` }}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                <Clock size={11} /> {metrics.etaMin} min
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                <Navigation size={11} /> {metrics.progress}%
              </span>
              {metrics.speedKmh > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                  <Gauge size={11} /> {Math.round(metrics.speedKmh)} km/h
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapboxLiveMap;
