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

export function GpsMapView({ points, className = "", origin, destination }: GpsMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Default center: France
    const defaultCenter: [number, number] = [46.8, 2.3];
    const fallbackCenter: [number, number] | null = destination
      ? [destination.lat, destination.lng]
      : origin
        ? [origin.lat, origin.lng]
        : null;
    const center: [number, number] = points.length > 0
      ? [points[points.length - 1].latitude, points[points.length - 1].longitude]
      : fallbackCenter ?? defaultCenter;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center,
        zoom: points.length > 0 || fallbackCenter ? 11 : 6,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear existing layers (except tile layer)
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    const bounds = L.latLngBounds([] as L.LatLngExpression[]);

    // Origin marker
    if (origin) {
      const originIcon = L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([origin.lat, origin.lng], { icon: originIcon })
        .bindPopup(`<b>Départ</b><br>${origin.label ?? ""}`)
        .addTo(map);
      bounds.extend([origin.lat, origin.lng]);
    }

    // Destination marker
    if (destination) {
      const destIcon = L.divIcon({
        className: "",
        html: '<div style="width:16px;height:20px;background:#ef4444;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>',
        iconSize: [16, 20],
        iconAnchor: [8, 18],
      });
      L.marker([destination.lat, destination.lng], { icon: destIcon })
        .bindPopup(`<b>Arrivée</b><br>${destination.label ?? ""}`)
        .addTo(map);
      bounds.extend([destination.lat, destination.lng]);
    }

    if (points.length > 0) {
      // Draw polyline for the route
      const coords: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
      const polyline = L.polyline(coords, { color: "#d4af37", weight: 3, opacity: 0.85 }).addTo(map);
      polyline.getLatLngs().forEach((ll) => bounds.extend(ll as L.LatLng));

      // Departure of the GPS trace (only if no explicit origin)
      if (!origin) {
        const startIcon = L.divIcon({
          className: "",
          html: '<div style="width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid white"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker([points[0].latitude, points[0].longitude], { icon: startIcon })
          .bindPopup(`<b>Début du suivi</b><br>${new Date(points[0].recorded_at).toLocaleString("fr-FR")}`)
          .addTo(map);
      }

      // Current position (gold, pulsing)
      const last = points[points.length - 1];
      const currentIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative">
          <div style="width:16px;height:16px;border-radius:50%;background:#d4af37;border:2px solid white;box-shadow:0 0 6px rgba(212,175,55,0.6)"></div>
          <div style="position:absolute;top:-4px;left:-4px;width:24px;height:24px;border-radius:50%;border:2px solid #d4af37;opacity:0.4;animation:ping 1.5s infinite"></div>
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([last.latitude, last.longitude], { icon: currentIcon })
        .bindPopup(`<b>Position actuelle</b><br>${new Date(last.recorded_at).toLocaleString("fr-FR")}<br>Précision : ${last.accuracy ? Math.round(last.accuracy) + "m" : "N/A"}`)
        .addTo(map);

      // Projected dashed line from current pos → destination
      if (destination) {
        L.polyline(
          [[last.latitude, last.longitude], [destination.lat, destination.lng]],
          { color: "#d4af37", weight: 2, opacity: 0.5, dashArray: "6 8" },
        ).addTo(map);
      }
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.15));
    }

    // Inject animation CSS
    if (!document.getElementById("leaflet-ping-css")) {
      const style = document.createElement("style");
      style.id = "leaflet-ping-css";
      style.textContent = `@keyframes ping{0%{transform:scale(1);opacity:0.4}75%{transform:scale(1.8);opacity:0}100%{transform:scale(1.8);opacity:0}}`;
      document.head.appendChild(style);
    }
  }, [points, origin, destination]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return <div ref={mapRef} className={`rounded border border-primary/20 ${className}`} style={{ minHeight: "300px" }} />;
}
