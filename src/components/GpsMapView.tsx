import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface GpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

interface LatLngLabel { lat: number; lng: number; label?: string }

interface GpsMapViewProps {
  points: GpsPoint[];
  className?: string;
  /** Optional origin marker (green pin with label) */
  origin?: LatLngLabel | null;
  /** Optional destination marker (red pin) + projected dashed line from current pos */
  destination?: LatLngLabel | null;
}

// Tile theme · CartoDB Positron : style clair épuré, type Uber/Bolt.
const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>';

const ROUTE_PRIMARY = "#2563eb"; // bleu profond
const ROUTE_SECONDARY = "#7c3aed"; // violet premium
const ROUTE_HALO = "#ffffff";
const COLOR_START = "#10b981"; // vert départ
const COLOR_END = "#ef4444"; // rouge arrivée

/** Bearing en degrés entre deux points (atan2). */
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** SVG voiture top-down stylisée (orientée vers le haut → 0°). */
const CAR_SVG = `<svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <filter id="cs" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#cs)">
    <rect x="11" y="6" width="18" height="28" rx="6" fill="url(#cg)" stroke="#fff" stroke-width="2"/>
    <rect x="13" y="10" width="14" height="7" rx="2" fill="rgba(255,255,255,0.85)"/>
    <rect x="13" y="22" width="14" height="8" rx="2" fill="rgba(255,255,255,0.25)"/>
    <circle cx="20" cy="34" r="1.6" fill="#fff" opacity="0.9"/>
  </g>
</svg>`;

function carIcon(heading: number) {
  return L.divIcon({
    className: "ligneo-car-marker",
    html: `<div style="transform:rotate(${heading}deg);transform-origin:center;transition:transform 600ms ease-out">${CAR_SVG}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function startIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative">
      <div style="width:18px;height:18px;border-radius:50%;background:${COLOR_START};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25)"></div>
      <div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${COLOR_START};opacity:0.35;animation:ligneo-ping 1.8s infinite"></div>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function endIcon() {
  return L.divIcon({
    className: "",
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="ps" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.27 21.73 0 14 0z" fill="${COLOR_END}" stroke="#fff" stroke-width="2" filter="url(#ps)"/>
      <circle cx="14" cy="14" r="5" fill="#fff"/>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  });
}

export function GpsMapView({ points, className = "", origin, destination }: GpsMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const carMarkerRef = useRef<L.Marker | null>(null);
  const animRef = useRef<number | null>(null);
  const lastLatLngRef = useRef<L.LatLng | null>(null);
  const lastHeadingRef = useRef<number>(0);

  // Mount once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const defaultCenter: [number, number] = [46.8, 2.3];
    mapInstanceRef.current = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 6,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: "topright" }).addTo(mapInstanceRef.current);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(mapInstanceRef.current);

    // Inject CSS once
    if (!document.getElementById("ligneo-map-css")) {
      const style = document.createElement("style");
      style.id = "ligneo-map-css";
      style.textContent = `
        @keyframes ligneo-ping{0%{transform:scale(1);opacity:0.5}80%{transform:scale(2);opacity:0}100%{transform:scale(2);opacity:0}}
        .ligneo-car-marker{will-change:transform}
        .leaflet-container{font-family:inherit;background:#f3f6fb;z-index:0 !important}
        .leaflet-pane,.leaflet-top,.leaflet-bottom,.leaflet-control{z-index:1 !important}
        .leaflet-control-zoom{z-index:2 !important}
        .leaflet-control-attribution{font-size:9px !important;padding:1px 4px !important;background:rgba(255,255,255,0.85) !important;border-radius:3px 0 0 0;z-index:2 !important}
        .leaflet-control-zoom a{border:none !important;background:rgba(255,255,255,0.95) !important;color:#0f172a !important;backdrop-filter:blur(8px);box-shadow:0 2px 8px rgba(15,23,42,0.12)}
        .leaflet-control-zoom a:hover{background:#fff !important}
      `;
      document.head.appendChild(style);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render layers when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear all but tile layer
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });
    carMarkerRef.current = null;

    const bounds = L.latLngBounds([] as L.LatLngExpression[]);

    if (origin) {
      L.marker([origin.lat, origin.lng], { icon: startIcon() })
        .bindPopup(`<b>Départ</b><br>${origin.label ?? ""}`)
        .addTo(map);
      bounds.extend([origin.lat, origin.lng]);
    }

    if (destination) {
      L.marker([destination.lat, destination.lng], { icon: endIcon() })
        .bindPopup(`<b>Arrivée</b><br>${destination.label ?? ""}`)
        .addTo(map);
      bounds.extend([destination.lat, destination.lng]);
    }

    if (points.length > 0) {
      const coords: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
      // Halo blanc + tracé bleu pour lisibilité premium
      L.polyline(coords, { color: ROUTE_HALO, weight: 8, opacity: 0.85, lineCap: "round", lineJoin: "round" }).addTo(map);
      L.polyline(coords, { color: ROUTE_PRIMARY, weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(map);
      coords.forEach((c) => bounds.extend(c));

      if (!origin) {
        L.marker(coords[0], { icon: startIcon() }).addTo(map);
      }

      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      const heading = prev ? bearing({ lat: prev.latitude, lng: prev.longitude }, { lat: last.latitude, lng: last.longitude }) : lastHeadingRef.current;
      lastHeadingRef.current = heading;

      const newLatLng = L.latLng(last.latitude, last.longitude);
      const marker = L.marker(newLatLng, { icon: carIcon(heading), zIndexOffset: 1000 })
        .bindPopup(`<b>Position actuelle</b><br>${new Date(last.recorded_at).toLocaleTimeString("fr-FR")}`);
      marker.addTo(map);
      carMarkerRef.current = marker;

      // Animate from previous → current
      const start = lastLatLngRef.current ?? newLatLng;
      lastLatLngRef.current = newLatLng;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const t0 = performance.now();
      const dur = 900;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        const lat = start.lat + (newLatLng.lat - start.lat) * t;
        const lng = start.lng + (newLatLng.lng - start.lng) * t;
        marker.setLatLng([lat, lng]);
        if (t < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);

      // Tracé projeté pointillé jusqu'à destination
      if (destination) {
        L.polyline([[last.latitude, last.longitude], [destination.lat, destination.lng]], {
          color: ROUTE_SECONDARY,
          weight: 3,
          opacity: 0.55,
          dashArray: "4 10",
          lineCap: "round",
        }).addTo(map);
      }
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.18), { animate: true, duration: 0.6 });
    }
  }, [points, origin, destination]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden shadow-lg ring-1 ring-slate-900/5 ${className}`}
      style={{ minHeight: 300, isolation: "isolate", zIndex: 0 }}
    >
      <div ref={mapRef} className="absolute inset-0" />
    </div>
  );
}
