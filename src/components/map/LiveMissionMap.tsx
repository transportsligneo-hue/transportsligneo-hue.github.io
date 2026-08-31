import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress } from "@/lib/geocode";
import { haversineKm } from "@/lib/geo/haversine";
import { Minus, Plus, Crosshair, Gauge, Clock, Navigation } from "lucide-react";

export interface LiveGpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy?: number | null;
  speed?: number | null;
}

export interface LiveMissionMapProps {
  /** Historique GPS (ordre chronologique croissant) */
  points: LiveGpsPoint[];
  /** Adresse ou coordonnées de départ */
  origin?: { lat: number; lng: number; label?: string } | string | null;
  /** Adresse ou coordonnées d'arrivée */
  destination?: { lat: number; lng: number; label?: string } | string | null;
  className?: string;
  /** Masquer la carte d'informations flottante */
  hideOverlay?: boolean;
  /** Libellé affiché dans l'overlay */
  title?: string;
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const BRAND = "#2F5FFF";
const BRAND_DARK = "#1c3fc4";
const GOLD = "#B8862A";
const REST = "#cfd6e4";

const CSS_ID = "ligneo-live-map-css";
const MAP_CSS = `
.ligneo-live-map .leaflet-tile-pane{ filter: saturate(0.75) brightness(1.03) contrast(0.97); }
.ligneo-live-map .leaflet-container{ font-family:inherit; background:#eef1f7; z-index:0 !important; }
.ligneo-live-map .leaflet-pane,.ligneo-live-map .leaflet-top,.ligneo-live-map .leaflet-bottom{ z-index:1 !important; }
.ligneo-live-map .leaflet-control-attribution{ font-size:9px !important; background:rgba(255,255,255,.8) !important; }
.ligneo-car{ will-change:transform; }
.ligneo-car .halo{ position:absolute; inset:-14px; border-radius:50%; background:radial-gradient(circle, rgba(47,95,255,.35) 0%, rgba(47,95,255,0) 70%); animation:ligneo-halo 2s ease-out infinite; }
@keyframes ligneo-halo{0%{transform:scale(.6);opacity:.9}70%{transform:scale(1.4);opacity:0}100%{opacity:0}}
`;

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const CAR_SVG = `<svg viewBox="0 0 40 40" width="34" height="34" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lgcar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5b86ff"/><stop offset="100%" stop-color="#1c3fc4"/>
    </linearGradient>
  </defs>
  <circle cx="20" cy="20" r="15" fill="url(#lgcar)" stroke="#fff" stroke-width="3"/>
  <path d="M14 24.5v-2.2l1.2-3.8c.2-.7.9-1.2 1.7-1.2h6.2c.8 0 1.5.5 1.7 1.2l1.2 3.8v2.2c0 .5-.4.9-.9.9h-1c-.5 0-.9-.4-.9-.9v-.7h-6.4v.7c0 .5-.4.9-.9.9h-1c-.5 0-.9-.4-.9-.9z" fill="#fff"/>
  <path d="M20 10.5l2.4 3.2h-4.8z" fill="#fff" opacity=".95"/>
</svg>`;

function carIcon(heading: number) {
  return L.divIcon({
    className: "ligneo-car",
    html: `<div style="position:relative;width:34px;height:34px"><span class="halo"></span><div style="transform:rotate(${heading}deg);transform-origin:center;transition:transform 700ms ease-out">${CAR_SVG}</div></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.28)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

type LL = { lat: number; lng: number; label?: string };

async function resolvePlace(v: LiveMissionMapProps["origin"]): Promise<LL | null> {
  if (!v) return null;
  if (typeof v === "string") {
    const g = await geocodeAddress(v);
    return g ? { lat: g.lat, lng: g.lng, label: v } : null;
  }
  return v;
}

/** Tracé routier réel via OSRM (démo publique). Fallback : ligne directe. */
async function fetchRoute(a: LL, b: LL): Promise<Array<[number, number]>> {
  try {
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,
    );
    if (!r.ok) throw new Error("osrm");
    const d = await r.json();
    const coords = d?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (!coords?.length) throw new Error("empty");
    return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
  } catch {
    return [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ];
  }
}

export function LiveMissionMap({
  points,
  origin,
  destination,
  className = "",
  hideOverlay = false,
  title,
}: LiveMissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const carRef = useRef<L.Marker | null>(null);
  const doneLineRef = useRef<L.Polyline | null>(null);
  const restLineRef = useRef<L.Polyline | null>(null);
  const startRef = useRef<L.Marker | null>(null);
  const endRef = useRef<L.Marker | null>(null);
  const animRef = useRef<number | null>(null);
  const posRef = useRef<L.LatLng | null>(null);
  const headingRef = useRef(0);
  const fittedRef = useRef(false);

  const [places, setPlaces] = useState<{ a: LL | null; b: LL | null }>({ a: null, b: null });
  const [route, setRoute] = useState<Array<[number, number]>>([]);

  const last = points.length ? points[points.length - 1] : null;

  // ——— Résolution des adresses
  const originKey = typeof origin === "string" ? origin : origin ? `${origin.lat},${origin.lng}` : "";
  const destKey = typeof destination === "string" ? destination : destination ? `${destination.lat},${destination.lng}` : "";
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

  // ——— Tracé routier réel (une seule fois par couple départ/arrivée)
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

    // Vitesse moyenne sur les derniers points
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

  // ——— Montage carte (une seule fois)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement("style");
      s.id = CSS_ID;
      s.textContent = MAP_CSS;
      document.head.appendChild(s);
    }
    const map = L.map(containerRef.current, {
      center: [46.8, 2.3],
      zoom: 6,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      map.remove();
      mapRef.current = null;
      carRef.current = null;
      doneLineRef.current = null;
      restLineRef.current = null;
      startRef.current = null;
      endRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // ——— Marqueurs départ / arrivée (mise à jour sans reset de la carte)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const a = places.a;
    const b = places.b;
    if (a) {
      if (!startRef.current) {
        startRef.current = L.marker([a.lat, a.lng], { icon: dotIcon(BRAND) })
          .bindTooltip(a.label ?? "Départ", { direction: "top", offset: [0, -10] })
          .addTo(map);
      } else {
        startRef.current.setLatLng([a.lat, a.lng]);
      }
    }
    if (b) {
      if (!endRef.current) {
        endRef.current = L.marker([b.lat, b.lng], { icon: dotIcon(GOLD) })
          .bindTooltip(b.label ?? "Arrivée", { direction: "top", offset: [0, -10] })
          .addTo(map);
      } else {
        endRef.current.setLatLng([b.lat, b.lng]);
      }
    }
  }, [places]);

  // ——— Polylignes parcouru / restant
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !metrics) return;
    if (!restLineRef.current) {
      restLineRef.current = L.polyline(metrics.rest, {
        color: REST,
        weight: 6,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    } else {
      restLineRef.current.setLatLngs(metrics.rest);
    }
    if (!doneLineRef.current) {
      doneLineRef.current = L.polyline(metrics.done, {
        color: BRAND,
        weight: 6,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    } else {
      doneLineRef.current.setLatLngs(metrics.done);
    }
    doneLineRef.current.bringToFront();

    if (!fittedRef.current && route.length) {
      fittedRef.current = true;
      map.fitBounds(L.latLngBounds(route as L.LatLngExpression[]).pad(0.15), { animate: false });
    }
  }, [metrics, route]);

  // ——— Marqueur véhicule : interpolation douce + rotation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !last) return;
    const target = L.latLng(last.latitude, last.longitude);
    const prev = points[points.length - 2];
    if (prev) {
      headingRef.current = bearing(
        { lat: prev.latitude, lng: prev.longitude },
        { lat: last.latitude, lng: last.longitude },
      );
    }
    if (!carRef.current) {
      carRef.current = L.marker(target, { icon: carIcon(headingRef.current), zIndexOffset: 1000 }).addTo(map);
      posRef.current = target;
      if (!route.length && !fittedRef.current) {
        fittedRef.current = true;
        map.setView(target, 12, { animate: false });
      }
      return;
    }
    carRef.current.setIcon(carIcon(headingRef.current));
    const from = posRef.current ?? target;
    posRef.current = target;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const t0 = performance.now();
    const dur = 900;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      carRef.current?.setLatLng([
        from.lat + (target.lat - from.lat) * e,
        from.lng + (target.lng - from.lng) * e,
      ]);
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, [last, points, route.length]);

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (route.length) map.fitBounds(L.latLngBounds(route as L.LatLngExpression[]).pad(0.15));
    else if (posRef.current) map.setView(posRef.current, 13);
  };

  return (
    <div
      className={`ligneo-live-map relative overflow-hidden rounded-2xl ring-1 ring-slate-900/5 ${className}`}
      style={{ minHeight: 320, isolation: "isolate" }}
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

            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-150 bg-slate-100">
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

export default LiveMissionMap;
