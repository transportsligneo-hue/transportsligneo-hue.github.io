import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureLocationPermission } from "@/lib/native/bridge";

interface UseGpsTrackingOptions {
  attributionId: string | null;
  active: boolean;
  intervalMs?: number;
}

export function useGpsTracking({ attributionId, active, intervalMs = 12000 }: UseGpsTrackingOptions) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  const sendPosition = useCallback(async (position: GeolocationPosition) => {
    if (!attributionId) return;
    const now = Date.now();
    if (now - lastSentRef.current < intervalMs) return;
    lastSentRef.current = now;

    const { error } = await supabase.from("mission_locations").insert({
      attribution_id: attributionId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: Number.isFinite(position.coords.speed as number) ? position.coords.speed : null,
      heading: Number.isFinite(position.coords.heading as number) ? position.coords.heading : null,
      recorded_at: new Date(position.timestamp).toISOString(),
    });
    if (error) {
      // Ne pas perdre le point suivant si l'insertion échoue (réseau, RLS…)
      lastSentRef.current = 0;
      console.warn("GPS insert error:", error.message);
    }
  }, [attributionId, intervalMs]);

  useEffect(() => {
    if (!active || !attributionId || !navigator.geolocation) return;
    let cancelled = false;

    void ensureLocationPermission().then((ok) => {
      if (!ok || cancelled) return;
      watchIdRef.current = navigator.geolocation.watchPosition(
        sendPosition,
        (err) => console.warn("GPS error:", err.message),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    });

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, attributionId, sendPosition]);
}

