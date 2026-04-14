import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

    await supabase.from("mission_locations").insert({
      attribution_id: attributionId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      recorded_at: new Date(position.timestamp).toISOString(),
    });
  }, [attributionId, intervalMs]);

  useEffect(() => {
    if (!active || !attributionId || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      sendPosition,
      (err) => console.warn("GPS error:", err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, attributionId, sendPosition]);
}
