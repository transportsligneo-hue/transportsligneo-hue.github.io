import { useEffect, useState, useCallback } from "react";
import type { LatLng } from "./haversine";

const STORAGE_KEY = "convoyeur_geo_v1";

interface GeoState {
  position: LatLng | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    position: null,
    loading: false,
    error: null,
  });

  // Restore from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LatLng;
        if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") {
          setState((s) => ({ ...s, position: parsed }));
        }
      }
    } catch {
      /* noop */
    }
  }, []);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ position: null, loading: false, error: "Géolocalisation non supportée" });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        } catch {
          /* noop */
        }
        setState({ position: p, loading: false, error: null });
      },
      (err) => {
        setState({
          position: null,
          loading: false,
          error: err.message || "Position refusée",
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setState({ position: null, loading: false, error: null });
  }, []);

  return { ...state, request, clear };
}
