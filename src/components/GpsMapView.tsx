import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface GpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

interface GpsMapViewProps {
  points: GpsPoint[];
  className?: string;
}

export function GpsMapView({ points, className = "" }: GpsMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Default center: France
    const defaultCenter: [number, number] = [46.8, 2.3];
    const center: [number, number] = points.length > 0
      ? [points[points.length - 1].latitude, points[points.length - 1].longitude]
      : defaultCenter;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center,
        zoom: points.length > 0 ? 13 : 6,
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

    if (points.length === 0) return;

    // Draw polyline for the route
    const coords: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
    const polyline = L.polyline(coords, {
      color: "#d4af37",
      weight: 3,
      opacity: 0.8,
    }).addTo(map);

    // Start marker (green)
    const startIcon = L.divIcon({
      className: "",
      html: '<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker([points[0].latitude, points[0].longitude], { icon: startIcon })
      .bindPopup(`<b>Départ</b><br>${new Date(points[0].recorded_at).toLocaleString("fr-FR")}`)
      .addTo(map);

    // Current position marker (gold, pulsing)
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
      .bindPopup(`<b>Position actuelle</b><br>${new Date(last.recorded_at).toLocaleString("fr-FR")}<br>Précision: ${last.accuracy ? Math.round(last.accuracy) + "m" : "N/A"}`)
      .addTo(map);

    // Fit bounds
    map.fitBounds(polyline.getBounds().pad(0.1));

    // Inject animation CSS
    if (!document.getElementById("leaflet-ping-css")) {
      const style = document.createElement("style");
      style.id = "leaflet-ping-css";
      style.textContent = `@keyframes ping{0%{transform:scale(1);opacity:0.4}75%{transform:scale(1.8);opacity:0}100%{transform:scale(1.8);opacity:0}}`;
      document.head.appendChild(style);
    }
  }, [points]);

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
