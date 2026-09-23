import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureLocationPermission } from "@/lib/native/bridge";
import { isNativeApp } from "@/lib/native/bridge";
import { toast } from "sonner";

interface UseGpsTrackingOptions {
  attributionId: string | null;
  active: boolean;
  intervalMs?: number;
}

export function useGpsTracking({ attributionId, active, intervalMs = 12000 }: UseGpsTrackingOptions) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const sendingRef = useRef(false);

  const sendPosition = useCallback(async (position: GeolocationPosition) => {
    if (!attributionId) return;
    if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)) return;
    const now = Date.now();
    if (sendingRef.current || now - lastSentRef.current < intervalMs) return;
    sendingRef.current = true;

    try {
      const { error } = await supabase.from("mission_locations").insert({
        attribution_id: attributionId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: Number.isFinite(position.coords.speed as number) ? position.coords.speed : null,
        heading: Number.isFinite(position.coords.heading as number) ? position.coords.heading : null,
        recorded_at: new Date(position.timestamp).toISOString(),
      });
      if (error) throw error;
      lastSentRef.current = Date.now();
    } catch (error) {
      console.warn("GPS insert error:", error);
      toast.error("Position non transmise", { description: "Vérifiez votre connexion internet et gardez l'application Driver ouverte." });
    } finally {
      sendingRef.current = false;
    }
  }, [attributionId, intervalMs]);

  useEffect(() => {
    if (!active || !attributionId) return;
    let cancelled = false;
    let nativeWatchId: string | null = null;
    let pollId: number | null = null;
    lastSentRef.current = 0;

    const onError = (error: { message?: string }) => {
      console.warn("GPS error:", error.message);
      toast.error("Position GPS indisponible", { description: "Activez la localisation précise et gardez l'application Driver ouverte pendant le trajet." });
    };
    const startWeb = () => {
      if (!navigator.geolocation) { onError({ message: "Geolocation unavailable" }); return; }
      watchIdRef.current = navigator.geolocation.watchPosition(sendPosition, onError,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
      // Some mobile browsers pause watchPosition after returning from navigation.
      const sample = () => {
        if (!cancelled && document.visibilityState === "visible")
          navigator.geolocation.getCurrentPosition(sendPosition, onError,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
      };
      sample();
      pollId = window.setInterval(sample, Math.max(intervalMs, 15000));
    };

    void ensureLocationPermission().then((ok) => {
      if (cancelled) return;
      if (!ok) { onError({ message: "Location permission denied" }); return; }
      if (!isNativeApp()) { startWeb(); return; }
      void import("@capacitor/geolocation").then(async ({ Geolocation }) => {
        if (cancelled) return;
        const sample = async () => {
          try {
            const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
            if (!cancelled) void sendPosition(position);
          } catch (error) { if (!cancelled) onError(error as { message?: string }); }
        };
        try {
          const id = await Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
            (position, error) => {
              if (cancelled) return;
              if (error) onError(error);
              else if (position) void sendPosition(position);
            });
          if (cancelled) void Geolocation.clearWatch({ id });
          else nativeWatchId = id;
          await sample();
          if (!cancelled) pollId = window.setInterval(() => { if (document.visibilityState === "visible") void sample(); }, Math.max(intervalMs, 15000));
        } catch (error) { if (!cancelled) onError(error as { message?: string }); }
      }).catch(onError);
    });

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      if (nativeWatchId) void import("@capacitor/geolocation").then(({ Geolocation }) => Geolocation.clearWatch({ id: nativeWatchId ?? "" }));
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, attributionId, sendPosition]);
}

