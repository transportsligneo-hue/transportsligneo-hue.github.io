import { useSnappedTrail } from "./snap-trail";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { geocodeAddress } from "@/lib/geocode";
import { haversineKm } from "@/lib/geo/haversine";
import { Minus, Plus, Crosshair, Gauge, Clock, Navigation, AlertTriangle, Flag, Coffee, PauseCircle, BadgeCheck, Route } from "lucide-react";
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
import { AdminEtaStrip } from "./AdminEtaStrip";
import { computeNextMilestone, type NextMilestone } from "@/lib/mission-next-step";
export { MAPBOX_TOKEN };

const STYLE_URL = "mapbox://styles/mapbox/light-v11";
const BRAND = "#2F5FFF";
const BRAND_DARK = "#1c3fc4";
const GOLD = "#B8862A";
const REST = "#c9d2e3";
const RETOUR = "#10B981";

const CSS_ID = "ligneo-mapbox-css";
const MAP_CSS = `
.ligneo-mbx, .ligneo-mbx .mapboxgl-map{ width:100%; height:100%; }
.ligneo-mbx .mapboxgl-canvas-container, .ligneo-mbx .mapboxgl-canvas{ width:100% !important; height:100% !important; }
.ligneo-mbx .mapboxgl-ctrl-logo{ opacity:.55; transform:scale(.8); transform-origin:left bottom; }
.ligneo-mbx .mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib{ font-size:9px; background:rgba(255,255,255,.75); }
.ligneo-mbx-car{ will-change:transform; }
.ligneo-mbx-car .halo{ position:absolute; inset:-8px; border-radius:50%; background:radial-gradient(circle, rgba(47,95,255,.22) 0%, rgba(47,95,255,0) 65%); animation:ligneo-mbx-halo 2.2s ease-out infinite; }
.ligneo-mbx-car.is-stale .halo{display:none}
.ligneo-mbx-car.is-stale img{filter:grayscale(1) drop-shadow(0 4px 7px rgba(11,16,38,.3)) !important;opacity:.8}
@keyframes ligneo-mbx-halo{0%{transform:scale(.7);opacity:.8}70%{transform:scale(1.35);opacity:0}100%{opacity:0}}
.ligneo-mbx-done{ animation:ligneo-mbx-done-in .5s cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes ligneo-mbx-done-in{0%{transform:translateY(14px);opacity:0}100%{transform:translateY(0);opacity:1}}
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
  try {
    const r = await fetch(
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,
    );
    const d = await r.json();
    const coords = d?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (coords?.length) return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
  } catch {
    /* ligne directe en dernier recours */
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

/** Trace GPS : coupe les segments trop longs (positions espacées) pour ne jamais tirer de trait droit. */
const MAX_TRAIL_GAP_KM = 3;
function trailFeature(coords: Array<[number, number]>): GeoJSON.Feature<GeoJSON.MultiLineString> {
  const lines: number[][][] = [];
  let cur: number[][] = [];
  for (let i = 0; i < coords.length; i++) {
    const [lat, lng] = coords[i];
    if (i > 0) {
      const d = haversineKm({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat, lng });
      if (d > MAX_TRAIL_GAP_KM) {
        if (cur.length >= 2) lines.push(cur);
        cur = [];
      }
    }
    cur.push([lng, lat]);
  }
  if (cur.length >= 2) lines.push(cur);
  return { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: lines } };
}

/** Aller-retour : sépare la trace au point le plus éloigné du départ si le véhicule est revenu vers son point de départ. */
function splitAllerRetour(trail: Array<[number, number]>): { aller: Array<[number, number]>; retour: Array<[number, number]> } {
  if (trail.length < 6) return { aller: trail, retour: [] };
  const o = { lat: trail[0][0], lng: trail[0][1] };
  let k = 0;
  let maxD = 0;
  trail.forEach(([lat, lng], i) => {
    const d = haversineKm(o, { lat, lng });
    if (d > maxD) {
      maxD = d;
      k = i;
    }
  });
  const end = trail[trail.length - 1];
  const backD = haversineKm(o, { lat: end[0], lng: end[1] });
  if (maxD < 5 || k < 2 || trail.length - 1 - k < 3 || backD > maxD * 0.7) return { aller: trail, retour: [] };
  return { aller: trail.slice(0, k + 1), retour: trail.slice(k) };
}

function dotEl(color: string, label?: string) {
  const el = document.createElement("div");
  el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.28)`;
  if (label) el.title = label;
  return el;
}

/** L'image de la voiture regarde vers l'arrière : on la retourne pour qu'elle avance dans le sens du trajet. */
const CAR_OFFSET = 180;

/** Drapeau d'arrivée rouge, planté à côté du véhicule quand la mission est terminée. */
function flagEl() {
  const el = document.createElement("div");
  el.className = "ligneo-mbx-flag";
  el.style.cssText = "width:44px;height:58px;pointer-events:none;filter:drop-shadow(0 5px 6px rgba(11,16,38,.35));";
  el.innerHTML = '<div style="animation:ligneo-mbx-done-in .6s cubic-bezier(.2,.9,.3,1.2) both"><svg viewBox="0 0 44 58" width="44" height="58" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d5e"/><stop offset="1" stop-color="#c4122f"/></linearGradient></defs><ellipse cx="10" cy="55" rx="7" ry="2.2" fill="rgba(11,16,38,.28)"/><rect x="8.5" y="4" width="3" height="51" rx="1.5" fill="#e9edf7" stroke="#9aa6c4" stroke-width=".6"/><circle cx="10" cy="4" r="3.2" fill="#fff" stroke="#9aa6c4" stroke-width=".6"/><path d="M11.5 7 C 19 3.5, 25 11, 32 7 C 36 5, 39 6, 41 7 L 41 25 C 39 24, 36 23, 32 25 C 25 29, 19 21, 11.5 25 Z" fill="url(#lfg)"/><path d="M11.5 7 C 19 3.5, 25 11, 32 7 C 36 5, 39 6, 41 7" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/></svg></div>';
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
  inner.style.transform = `rotate(${heading + CAR_OFFSET}deg)`;
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
  worldOverview = false,
  role = "client",
  onMetrics,
  etaDeltaMin = null,
  completed = false,
  completedPlaque = null,
  plate = null,
  etaStrip = false,
}: LiveMissionMapProps) {
  const isAdmin = role === "admin";
  const useStrip = isAdmin && etaStrip;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const carRef = useRef<mapboxgl.Marker | null>(null);
  const flagRef = useRef<mapboxgl.Marker | null>(null);
  const carInnerRef = useRef<HTMLDivElement | null>(null);
  const fleetRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const startRef = useRef<mapboxgl.Marker | null>(null);
  const endRef = useRef<mapboxgl.Marker | null>(null);
  const animRef = useRef<number | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef(0);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const hasReturnRef = useRef(false);
  const [hasReturn, setHasReturn] = useState(false);

  const [places, setPlaces] = useState<{ a: LL | null; b: LL | null }>({ a: null, b: null });
  const [route, setRoute] = useState<Array<[number, number]>>([]);
  const snappedTrail = useSnappedTrail(points);
  const [milestone, setMilestone] = useState<NextMilestone | null>(null);
  // Tick pour rafraîchir la fraîcheur du signal sans recharger la page
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const last = points.length ? points[points.length - 1] : null;
  const signalAgeMin = signalAgeMinutes(last, nowTs);
  const signalLost = !last || signalAgeMin === null || signalAgeMin > SIGNAL_STALE_MIN;

  // Distance de la mission : itinéraire routier réel (précis), sinon somme des
  // segments GPS (sous-estime car ligne droite entre points espacés).
  const gpsKm = useMemo(() => {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += haversineKm(
        { lat: points[i - 1].latitude, lng: points[i - 1].longitude },
        { lat: points[i].latitude, lng: points[i].longitude },
      );
    }
    return d;
  }, [points]);
  const routeKm = useMemo(() => {
    let d = 0;
    for (let i = 1; i < route.length; i++) {
      d += haversineKm({ lat: route[i - 1][0], lng: route[i - 1][1] }, { lat: route[i][0], lng: route[i][1] });
    }
    return d;
  }, [route]);
  const distanceKm = routeKm >= 1 ? routeKm : gpsKm;

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

  // ——— Synthèse de fin de mission (heures, durée, distance, vitesse moyenne)
  const doneStats = useMemo(() => {
    if (!completed || !last) return null;
    const t1 = new Date(last.recorded_at);
    const t0 = points.length ? new Date(points[0].recorded_at) : null;
    const durMin = t0 ? Math.max(0, Math.round((t1.getTime() - t0.getTime()) / 60_000)) : 0;
    const hhmm = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const avg = durMin >= 5 && distanceKm >= 1 ? Math.round(distanceKm / (durMin / 60)) : null;
    return {
      arrivalTime: hhmm(t1),
      arrivalDate: t1.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
      departTime: t0 && durMin > 0 ? hhmm(t0) : null,
      durMin,
      avg: avg && avg < 160 ? avg : null,
    };
  }, [completed, last, points, distanceKm]);

  // ——— Prochaine étape clé (frontière / pause) — recalcul par paliers de 5 %
  const milestoneKey = metrics ? `${Math.floor(metrics.progress / 5)}-${route.length}` : "";
  useEffect(() => {
    if (!metrics || !route.length || signalLost) {
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
  }, [milestoneKey, signalLost]);

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
      ...(worldOverview ? { projection: { name: "globe" as const } } : {}),
       center: worldOverview ? [8, 22] : [2.3, 46.8],
       zoom: worldOverview ? 1.5 : 4.6,
      attributionControl: true,
      cooperativeGestures: false,
      antialias: true,
    });
    mapRef.current = map;
    map.on("load", () => {
      map.addSource("ligneo-rest", { type: "geojson", data: lineFeature([]) });
      map.addSource("ligneo-done", { type: "geojson", data: lineFeature([]) });
      map.addSource("ligneo-trail", { type: "geojson", data: trailFeature([]) });
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
      map.addSource("ligneo-trail-back", { type: "geojson", data: trailFeature([]) });
      map.addLayer({
        id: "ligneo-trail-back-line",
        type: "line",
        source: "ligneo-trail-back",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": RETOUR, "line-width": 5, "line-opacity": 1, "line-blur": 0.5 },
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
        existing.getElement().classList.toggle("is-stale", !!f.stale);
        existing.getElement().title = f.label ?? "";
      } else {
        const { wrap } = carEl(0, 52);
        wrap.classList.toggle("is-stale", !!f.stale);
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
     if (!worldOverview && !fittedRef.current && fleet.length) {
      fittedRef.current = true;
      const b = new mapboxgl.LngLatBounds();
      fleet.forEach((f) => b.extend([f.lng, f.lat]));
      map.fitBounds(b, { padding: 70, duration: 0, maxZoom: 12 });
    }
   }, [fleet, ready, worldOverview]);

  // ——— Tracés parcouru / restant + trace GPS réelle + zoom automatique
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // Itinéraire routier réel uniquement : un « itinéraire » à 2 points = ligne droite de secours, jamais dessinée.
    const realRoute = route.length > 2;
    (map.getSource("ligneo-rest") as mapboxgl.GeoJSONSource | undefined)?.setData(lineFeature(metrics && realRoute ? (signalLost ? route : metrics.rest) : []));
    (map.getSource("ligneo-done") as mapboxgl.GeoJSONSource | undefined)?.setData(lineFeature(metrics && realRoute ? metrics.done : []));

    // Trace réellement parcourue (positions du convoyeur), même sans itinéraire.
    const trail = snappedTrail;
    const legs = trail.length >= 2 ? splitAllerRetour(trail) : { aller: [], retour: [] };
    (map.getSource("ligneo-trail") as mapboxgl.GeoJSONSource | undefined)?.setData(trailFeature(legs.aller));
    (map.getSource("ligneo-trail-back") as mapboxgl.GeoJSONSource | undefined)?.setData(trailFeature(legs.retour));
    hasReturnRef.current = legs.retour.length >= 2;
    setHasReturn(hasReturnRef.current);

    if (!fittedRef.current && (route.length || trail.length)) {
      fittedRef.current = true;
      const b = new mapboxgl.LngLatBounds();
      if (!signalLost || !trail.length) route.forEach(([lat, lng]) => b.extend([lng, lat]));
      trail.forEach(([lat, lng]) => b.extend([lng, lat]));
      map.fitBounds(b, { padding: 60, duration: 0, maxZoom: 14 });
    }
  }, [metrics, route, points, snappedTrail, ready, signalLost]);

  // ——— Drapeau d'arrivée planté à côté du véhicule quand la mission est terminée
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!completed || !last) { flagRef.current?.remove(); flagRef.current = null; return; }
    const pos: [number, number] = [last.longitude, last.latitude];
    if (flagRef.current) { flagRef.current.setLngLat(pos); return; }
    flagRef.current = new mapboxgl.Marker({ element: flagEl(), anchor: "bottom", offset: [26, 8] }).setLngLat(pos).addTo(map);
  }, [completed, last, ready]);

  // ——— Véhicule : interpolation fluide + rotation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!last) {
      carRef.current?.remove();
      carRef.current = null;
      posRef.current = null;
      return;
    }
    const target = { lat: last.latitude, lng: last.longitude };
    const prev = points[points.length - 2];
    if (prev) {
      headingRef.current = bearing({ lat: prev.latitude, lng: prev.longitude }, target);
    }

    if (!carRef.current) {
      const { wrap, inner } = carEl(headingRef.current);
      wrap.classList.toggle("is-stale", signalLost && !completed);
      wrap.title = signalLost ? `Dernière position connue le ${new Date(last.recorded_at).toLocaleString("fr-FR")}` : "Position actuelle";
      carInnerRef.current = inner;
      carRef.current = new mapboxgl.Marker({ element: wrap }).setLngLat([target.lng, target.lat]).addTo(map);
      posRef.current = target;
      if (!route.length && !fittedRef.current) {
        fittedRef.current = true;
        map.jumpTo({ center: [target.lng, target.lat], zoom: 12 });
      }
      return;
    }

    carRef.current.getElement().classList.toggle("is-stale", signalLost && !completed);
    carRef.current.getElement().title = signalLost ? `Dernière position connue le ${new Date(last.recorded_at).toLocaleString("fr-FR")}` : "Position actuelle";
    if (carInnerRef.current) {
      carInnerRef.current.style.transition = "transform 800ms ease-out";
      carInnerRef.current.style.transform = `rotate(${headingRef.current + CAR_OFFSET}deg)`;
    }
    const cur = carRef.current.getLngLat();
    const from = cur ? { lat: cur.lat, lng: cur.lng } : (posRef.current ?? target);
    // Ignore GPS jitter (< 8 m) so the car never twitches backwards.
    if (haversineKm({ lat: from.lat, lng: from.lng }, { lat: target.lat, lng: target.lng }) < 0.008) return;
    posRef.current = target;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    // Glide over the real gap between GPS points so the car never stops between updates.
    const gapMs = prev ? new Date(last.recorded_at).getTime() - new Date(prev.recorded_at).getTime() : 0;
    const dur = Number.isFinite(gapMs) && gapMs > 0 ? Math.min(Math.max(gapMs, 1000), 10_000) : 1200;
    const t0 = performance.now();
    const step = (now: number) => {
      const e = Math.min(1, (now - t0) / dur);
      const t = e;
      carRef.current?.setLngLat([from.lng + (target.lng - from.lng) * e, from.lat + (target.lat - from.lat) * e]);
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else if (!map.getBounds()?.contains([target.lng, target.lat])) map.easeTo({ center: [target.lng, target.lat], duration: 800 });
    };
    animRef.current = requestAnimationFrame(step);
  }, [last, points, route.length, ready, signalLost]);

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

      {/* Badge Live / Signal perdu / Mission terminée */}
      {completed ? (
        <div
          className="absolute left-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-lg backdrop-blur"
          style={{
            background: "linear-gradient(135deg, #0c1838, #0f1e42)",
            border: "1px solid rgba(46,230,113,.55)",
            boxShadow: "0 6px 18px rgba(11,16,38,.35), 0 0 14px rgba(46,230,113,.35)",
          }}
        >
          <BadgeCheck size={13} style={{ color: "#2ee671", filter: "drop-shadow(0 0 4px rgba(46,230,113,.8))" }} />
          Mission terminée{title ? ` · ${title}` : ""}
        </div>
      ) : !signalLost ? (
        <div className="absolute left-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-lg backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live{title ? ` · ${title}` : ""}
        </div>
      ) : null}

      {hasReturn && (
        <div className="absolute left-3 top-12 z-[400] inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-lg backdrop-blur">
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full" style={{ background: BRAND }} />Aller</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full" style={{ background: RETOUR }} />Retour</span>
        </div>
      )}

      {/* Admin : bandeau ETA unique (nouveau design) */}
      {useStrip && !hideOverlay && (
        <AdminEtaStrip
          metrics={metrics}
          etaDeltaMin={etaDeltaMin}
          plate={plate ?? completedPlaque}
          origin={typeof origin === "string" ? origin : origin && "label" in origin ? origin.label : null}
          destination={typeof destination === "string" ? destination : destination && "label" in destination ? destination.label : null}
          departTime={
            doneStats?.departTime ??
            (points.length ? new Date(points[0].recorded_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null)
          }
          completed={completed}
          done={doneStats}
          distanceKm={distanceKm}
          signalLost={signalLost}
          milestone={milestone}
          waiting={!completed && !metrics}
        />
      )}
      {/* Synthèse mission terminée */}
      {!useStrip && !hideOverlay && completed && (
        <div className="ligneo-mbx-done absolute bottom-3 left-3 right-3 z-[400] sm:right-auto sm:w-[320px]">
          <div
            className="rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, rgba(12,24,56,.96), rgba(15,30,66,.96))",
              border: "1px solid rgba(79,142,255,.45)",
              boxShadow: "0 14px 34px rgba(11,16,38,.45), 0 0 18px rgba(79,142,255,.28)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{ background: "rgba(46,230,113,.14)", border: "1px solid rgba(46,230,113,.5)" }}
              >
                <BadgeCheck size={18} style={{ color: "#2ee671", filter: "drop-shadow(0 0 5px rgba(46,230,113,.8))" }} />
              </span>
              <div className="min-w-[8.5rem] flex-1">
                <p className="text-[13px] font-extrabold tracking-wide text-white" style={{ textShadow: "0 0 10px rgba(46,230,113,.45)" }}>
                  Mission terminée
                </p>
                <p className="text-[10.5px] font-medium capitalize text-slate-300">
                  {doneStats ? doneStats.arrivalDate : "Trajet achevé"}
                </p>
              </div>
              {completedPlaque && (
                <span
                  className="ml-auto inline-flex shrink-0 items-center rounded-md px-2 py-1 text-[11px] font-bold tracking-widest text-white"
                  style={{ background: "rgba(47,95,255,.28)", border: "1px solid rgba(79,142,255,.6)" }}
                >
                  {completedPlaque}
                </span>
              )}
            </div>

            {doneStats && (
              <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Arrivée</p>
                  <p className="text-[26px] font-extrabold leading-none tabular-nums text-white">{doneStats.arrivalTime}</p>
                </div>
                {doneStats.departTime && (
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Départ</p>
                    <p className="text-lg font-bold leading-none tabular-nums text-slate-200">{doneStats.departTime}</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              {doneStats && doneStats.durMin > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-slate-200" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)" }}>
                  <Clock size={11} /> {formatDureeMinutes(doneStats.durMin)}
                </span>
              )}
              {distanceKm >= 1 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-slate-200" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)" }}>
                  <Route size={11} /> {distanceKm >= 100 ? Math.round(distanceKm) : distanceKm.toFixed(1)} km
                </span>
              )}
              {doneStats?.avg && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-slate-200" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)" }}>
                  <Gauge size={11} /> {doneStats.avg} km/h moy.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      {!useStrip && !hideOverlay && metrics && !signalLost && (
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
