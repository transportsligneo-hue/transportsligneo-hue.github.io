import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { geocodeAddress } from "@/lib/geocode";
import { haversineKm } from "@/lib/geo/haversine";
import { Minus, Plus, Crosshair, Gauge, Clock, Navigation, AlertTriangle, Flag, Coffee, PauseCircle } from "lucide-react";
import type { LiveMissionMapProps, MapPlace } from "./types";
import vehicleMarkerImg from "@/assets/ligneo-gps-car.png";

import { MAPBOX_TOKEN } from "@/lib/mapbox-token";
import { formatDureeMinutes, formatEta } from "@/lib/format-duration";
import {
  SIGNAL_STALE_MIN,
  signalAgeMinutes,
  stoppedMinutes,
  drivingSinceLastStopMinutes,
  formatMinutesShort,
  formatDelta,
} from "@/lib/mission-live-metrics";
import { computeNextMilestone, type NextMilestone } from "@/lib/mission-next-step";
export { MAPBOX_TOKEN };

const STYLE_URL = "mapbox://styles/mapbox/light-v11";
const BRAND = "#2F5FFF";
const BRAND_DARK = "#1c3fc4";
const GOLD = "#B8862A";
const REST = "#c9d2e3";

const CSS_ID = "ligneo-mapbox-css";
const MAP_CSS = `
.ligneo-mbx, .ligneo-mbx .mapboxgl-map{ width:100%; height:100%; }
.ligneo-mbx .mapboxgl-canvas-container, .ligneo-mbx .mapboxgl-canvas{ width:100% !important; height:100% !important; }
.ligneo-mbx .mapboxgl-ctrl-logo{ opacity:.55; transform:scale(.8); transform-origin:left bottom; }
.ligneo-mbx .mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib{ font-size:9px; background:rgba(255,255,255,.75); }
.ligneo-mbx-car{ will-change:transform; }
.ligneo-mbx-car .halo{ position:absolute; inset:-8px; border-radius:50%; background:radial-gradient(circle, rgba(47,95,255,.22) 0%, rgba(47,95,255,0) 65%); animation:ligneo-mbx-halo 2.2s ease-out infinite; }
@keyframes ligneo-mbx-halo{0%{transform:scale(.7);opacity:.8}70%{transform:scale(1.35);opacity:0}100%{opacity:0}}
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

type LL = { lat: number; lng: number; label?: string };

async function resolvePlace(v: MapPlace): Promise<LL | null> {
  if (!v) return null;
  if (typeof v === "string") {
    // 1) Géocodage Mapbox (précis, même clé publique).
    //    Aucune restriction "country=fr" : les missions sont européennes
    //    (Espagne, Italie, Allemagne…) et une adresse étrangère était sinon
    //    ramenée de force sur un point français → distances fausses.
    if (MAPBOX_TOKEN) {
      try {
        const r = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(v)}.json?limit=1&language=fr&access_token=${MAPBOX_TOKEN}`,
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

/** Marqueur véhicule (icône voiture Ligneo + halo pulsé), réutilisé en mode flotte. */
function carEl(heading: number, size = 62) {
  const wrap = document.createElement("div");
  wrap.className = "ligneo-mbx-car";
  wrap.style.cssText = `position:relative;width:${size}px;height:${size}px`;
  const halo = document.createElement("span");
  halo.className = "halo";
  const inner = document.createElement("div");
  inner.style.cssText = `width:${size}px;height:${size}px;transform-origin:center;transition:transform 700ms ease-out`;
  const image = document.createElement("img");
  image.src = vehicleMarkerImg;
  image.alt = "";
  image.draggable = false;
  image.style.cssText = `display:block;width:${size}px;height:${size}px;object-fit:contain;filter:drop-shadow(0 4px 7px rgba(11,16,38,.30));pointer-events:none;user-select:none`;
  inner.appendChild(image);
  inner.style.transform = `rotate(${heading}deg)`;
  wrap.append(halo, inner);
  return { wrap, inner };
}

export function MapboxLiveMap({
  points,
  origin,
  destination,
  className = "",
  hideOverlay = false,
  title,
  fleet,
  role = "client",
  onMetrics,
  etaDeltaMin = null,
}: LiveMissionMapProps) {
  const isAdmin = role === "admin";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const carRef = useRef<mapboxgl.Marker | null>(null);
  const carInnerRef = useRef<HTMLDivElement | null>(null);
  const fleetRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const startRef = useRef<mapboxgl.Marker | null>(null);
  const endRef = useRef<mapboxgl.Marker | null>(null);
  const animRef = useRef<number | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef(0);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);

  const [places, setPlaces] = useState<{ a: LL | null; b: LL | null }>({ a: null, b: null });
  const [route, setRoute] = useState<Array<[number, number]>>([]);
  const [milestone, setMilestone] = useState<NextMilestone | null>(null);
  // Tick pour rafraîchir la fraîcheur du signal sans recharger la page
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

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
    // Si aucun itinéraire routier n'a pu être calculé (fallback ligne droite),
    // on majore d'un facteur route pour ne pas sous-estimer la distance.
    const roadFactor = route.length <= 2 ? (total > 300 ? 1.25 : 1.3) : 1;
    const doneKm = cum[bestIdx] * roadFactor;
    const remainingKm = Math.max(0, total * roadFactor - doneKm);
    const progress = total > 0 ? Math.min(100, Math.round((cum[bestIdx] / total) * 100)) : 0;

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

    const signalAgeMin = signalAgeMinutes(last, nowTs);
    const stale = signalAgeMin != null && signalAgeMin > SIGNAL_STALE_MIN;
    const moving = !stale && speedKmh > 5;

    return {
      done: route.slice(0, bestIdx + 1),
      rest: route.slice(bestIdx),
      bestIdx,
      remainingKm,
      totalKm: total,
      progress,
      speedKmh,
      etaMin,
      etaAt: new Date(Date.now() + etaMin * 60_000),
      signalAgeMin,
      stale,
      moving,
      stoppedMin: stoppedMinutes(points),
      drivingMin: drivingSinceLastStopMinutes(points),
    };
  }, [route, points, last, nowTs]);

  // ——— Prochaine étape clé (frontière / pause) — recalcul par paliers de 5 %
  const milestoneKey = metrics ? `${Math.floor(metrics.progress / 5)}-${route.length}` : "";
  useEffect(() => {
    if (!metrics || !route.length) {
      setMilestone(null);
      return;
    }
    let dead = false;
    void computeNextMilestone({
      route,
      index: metrics.bestIdx,
      remainingKm: metrics.remainingKm,
      speedKmh: metrics.speedKmh,
      token: MAPBOX_TOKEN || null,
      drivingSinceLastStopMin: metrics.drivingMin,
    }).then((m) => {
      if (!dead) setMilestone(m);
    });
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneKey]);

  // ——— Remontée des métriques au parent (client / admin)
  useEffect(() => {
    if (!onMetrics) return;
    if (!metrics) {
      onMetrics(null);
      return;
    }
    onMetrics({
      remainingKm: metrics.remainingKm,
      totalKm: metrics.totalKm,
      progress: metrics.progress,
      speedKmh: metrics.speedKmh,
      etaMin: metrics.etaMin,
      etaAt: metrics.etaAt,
      signalAgeMin: metrics.signalAgeMin,
      stale: metrics.stale,
      moving: metrics.moving,
      stoppedMin: metrics.stoppedMin,
      nextMilestone: milestone,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, milestone]);

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
      map.addSource("ligneo-trail", { type: "geojson", data: lineFeature([]) });
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
      // Tracé réel parcouru par le convoyeur (points GPS), au-dessus de l'itinéraire
      map.addLayer({
        id: "ligneo-trail-line",
        type: "line",
        source: "ligneo-trail",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": BRAND, "line-width": 5, "line-opacity": 1, "line-blur": 0.5 },
      });
      readyRef.current = true;
      setReady(true);
      map.resize();
    });

    // Certains conteneurs (onglets, panneaux, dialogs) n'ont pas encore leur
    // taille finale au montage : on force plusieurs recalculs.
    const timers = [0, 120, 400, 900, 1600].map((d) => window.setTimeout(() => map.resize(), d));
    const onWinResize = () => map.resize();
    window.addEventListener("resize", onWinResize);
    // Resize uniquement si la taille réelle a changé (évite toute boucle de rendu)
    const syncSize = () => {
      const el = containerRef.current;
      if (!el) return;
      const c = map.getCanvas();
      if (Math.abs(c.clientWidth - el.clientWidth) > 1 || Math.abs(c.clientHeight - el.clientHeight) > 1) {
        map.resize();
      }
    };
    map.on("idle", syncSize);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    if (containerRef.current.parentElement) ro.observe(containerRef.current.parentElement);


    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", onWinResize);
      ro.disconnect();

      map.remove();
      mapRef.current = null;
      readyRef.current = false;
      carRef.current = null;
      carInnerRef.current = null;
      fleetRef.current.forEach((m) => m.remove());
      fleetRef.current.clear();
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

  // ——— Mode flotte : un marqueur voiture par mission active
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !fleet) return;
    const seen = new Set<number>();
    fleet.forEach((f, i) => {
      seen.add(i);
      const existing = fleetRef.current.get(i);
      if (existing) {
        existing.setLngLat([f.lng, f.lat]);
      } else {
        const { wrap } = carEl(0, 52);
        if (f.label) wrap.title = f.label;
        fleetRef.current.set(i, new mapboxgl.Marker({ element: wrap }).setLngLat([f.lng, f.lat]).addTo(map));
      }
    });
    fleetRef.current.forEach((m, i) => {
      if (!seen.has(i)) {
        m.remove();
        fleetRef.current.delete(i);
      }
    });
    if (!fittedRef.current && fleet.length) {
      fittedRef.current = true;
      const b = new mapboxgl.LngLatBounds();
      fleet.forEach((f) => b.extend([f.lng, f.lat]));
      map.fitBounds(b, { padding: 70, duration: 0, maxZoom: 12 });
    }
  }, [fleet, ready]);

  // ——— Tracés parcouru / restant + trace GPS réelle + zoom automatique
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (metrics) {
      (map.getSource("ligneo-rest") as mapboxgl.GeoJSONSource | undefined)?.setData(lineFeature(metrics.rest));
      (map.getSource("ligneo-done") as mapboxgl.GeoJSONSource | undefined)?.setData(lineFeature(metrics.done));
    }

    // Trace réellement parcourue (positions du convoyeur), même sans itinéraire.
    const trail = points.map((p) => [p.latitude, p.longitude] as [number, number]);
    (map.getSource("ligneo-trail") as mapboxgl.GeoJSONSource | undefined)?.setData(
      lineFeature(trail.length >= 2 ? trail : []),
    );

    if (!fittedRef.current && (route.length || trail.length)) {
      fittedRef.current = true;
      const b = new mapboxgl.LngLatBounds();
      route.forEach(([lat, lng]) => b.extend([lng, lat]));
      trail.forEach(([lat, lng]) => b.extend([lng, lat]));
      map.fitBounds(b, { padding: 60, duration: 0, maxZoom: 14 });
    }
  }, [metrics, route, points, ready]);

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
      const { wrap, inner } = carEl(headingRef.current);
      carInnerRef.current = inner;
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
    } else if (fleet?.length) {
      const b = new mapboxgl.LngLatBounds();
      fleet.forEach((f) => b.extend([f.lng, f.lat]));
      map.fitBounds(b, { padding: 70, maxZoom: 12 });
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

      {/* Badge Live / Signal perdu */}
      {(metrics?.stale || (!last && !fleet?.length)) ? (
        <div className="absolute left-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50/95 px-2.5 py-1 text-[11px] font-semibold text-amber-800 shadow-lg backdrop-blur">
          <AlertTriangle size={12} />
          {!last ? "En attente de la première position GPS" : isAdmin && metrics?.signalAgeMin != null
            ? `Dernière position reçue il y a ${formatMinutesShort(metrics.signalAgeMin)} · Signal perdu`
            : "Signal GPS perdu · Dernière position connue"}
          {title ? ` · ${title}` : ""}
        </div>
      ) : (
        <div className="absolute left-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-lg backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live{title ? ` · ${title}` : ""}
        </div>
      )}

      {/* Carte d'informations flottante */}
      {!hideOverlay && metrics && (
        <div className="absolute bottom-3 left-3 right-3 z-[400] sm:right-auto sm:w-[320px]">
          <div className="rounded-2xl border border-white/70 bg-white/92 p-3.5 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-xl">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Arrivée estimée</p>
                <p className="text-2xl font-extrabold leading-tight text-slate-900 tabular-nums">
                  {formatEta(metrics.etaAt)}
                  {formatDelta(etaDeltaMin) && (
                    <span
                      className={`ml-1.5 text-sm font-bold ${
                        (etaDeltaMin ?? 0) > 15 ? "text-amber-600" : "text-slate-500"
                      }`}
                    >
                      ({formatDelta(etaDeltaMin)})
                    </span>
                  )}
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
                <Clock size={11} /> {formatDureeMinutes(metrics.etaMin)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                <Navigation size={11} /> {metrics.progress}%
              </span>
              {/* Statut de roulage : visible client + admin */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                  metrics.moving ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {metrics.moving ? <Navigation size={11} /> : <PauseCircle size={11} />}
                {metrics.moving ? "En route" : "À l'arrêt"}
              </span>

              {/* Vitesse + fraîcheur du signal : admin uniquement */}
              {isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                  <Gauge size={11} /> {metrics.speedKmh > 1 ? `${Math.round(metrics.speedKmh)} km/h` : "non disponible"}
                </span>
              )}
              {isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                  <Clock size={11} />
                  {metrics.signalAgeMin != null
                    ? `Dernière position il y a ${formatMinutesShort(metrics.signalAgeMin)}`
                    : "Position non disponible"}
                </span>
              )}

              {/* Temps d'arrêt cumulé */}
              {metrics.stoppedMin > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                  <Coffee size={11} /> {formatMinutesShort(metrics.stoppedMin)} d'arrêt
                </span>
              )}
            </div>

            {/* Prochaine étape clé */}
            {milestone && (
              <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#f4f7ff] px-2.5 py-1.5 text-[11px] font-medium text-[#1c3fc4]">
                {milestone.kind === "frontiere" ? <Flag size={11} /> : <Coffee size={11} />}
                <span className="truncate">
                  Prochaine étape : {milestone.label}
                  {milestone.inMinutes ? ` · dans ~${formatMinutesShort(milestone.inMinutes)}` : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MapboxLiveMap;
