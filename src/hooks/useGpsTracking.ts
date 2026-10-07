import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureLocationPermission, isNativeApp } from "@/lib/native/bridge";
import { toast } from "sonner";
import { haversineKm } from "@/lib/geo/haversine";
import { CapacitorHttp, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

type GpsPosition = { coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null; heading: number | null }; timestamp: number };

// Android throttles WebView network requests after several minutes in the background.
// The native HTTP bridge keeps position uploads working while the foreground location
// service is running; the browser retains the normal authenticated client path.
async function uploadPosition(position: GpsPosition, attributionId: string, native: boolean) {
  const row = {
    attribution_id: attributionId,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    speed: Number.isFinite(position.coords.speed as number) ? position.coords.speed : null,
    heading: Number.isFinite(position.coords.heading as number) ? position.coords.heading : null,
    recorded_at: new Date(position.timestamp).toISOString(),
  };

  if (native) {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw error ?? new Error("Session Driver expirée");
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Configuration GPS indisponible");
    const response = await CapacitorHttp.post({
      url: `${url}/rest/v1/mission_locations`,
      headers: {
        apikey: key,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      data: row,
      connectTimeout: 15000,
      readTimeout: 15000,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Envoi GPS refusé (${response.status})`);
    }
    return;
  }

  const { error } = await supabase.from("mission_locations").insert(row);
  if (error) throw error;
}

interface UseGpsTrackingOptions {
  attributionId: string | null;
  active: boolean;
  intervalMs?: number;
}

export function useGpsTracking({ attributionId, active, intervalMs = 4000 }: UseGpsTrackingOptions) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const sendingRef = useRef(false);
  const lastErrorRef = useRef(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const sendPosition = useCallback(async (position: GpsPosition) => {
    if (!attributionId) return;
    if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)) return;
    // Do not report a cached lock from an earlier journey as a current position.
    if (!Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 120_000) return;
    const now = Date.now();
    // Stationary vehicle: slow uploads to ~30 s to save battery.
    const lp = lastPosRef.current;
    const movedM = lp ? haversineKm(lp, { lat: position.coords.latitude, lng: position.coords.longitude }) * 1000 : Infinity;
    const stopped = movedM < 10 && (position.coords.speed ?? 0) < 1;
    const minGap = stopped ? Math.max(intervalMs, 30_000) : intervalMs;
    if (sendingRef.current || now - lastSentRef.current < minGap) return;
    sendingRef.current = true;

    try {
      await uploadPosition(position, attributionId, isNativeApp());
      lastSentRef.current = Date.now();
      lastPosRef.current = { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch (error) {
      console.warn("GPS insert error:", error);
      if (Date.now() - lastErrorRef.current > 60_000) {
        lastErrorRef.current = Date.now();
        toast.error("Position non transmise", { description: "Vérifiez votre connexion et la localisation du téléphone." });
      }
    } finally {
      sendingRef.current = false;
    }
  }, [attributionId, intervalMs]);

  useEffect(() => {
    if (!active || !attributionId) return;
    let cancelled = false;
    let nativeWatchId: string | null = null;
    let pollId: number | null = null;
    let sampleOnResume: (() => void) | null = null;
    lastSentRef.current = 0;

    const onError = (error: { message?: string }) => {
      console.warn("GPS error:", error.message);
      toast.error("Position GPS indisponible", { description: "Activez la localisation précise sur votre téléphone." });
    };
    const startWeb = () => {
      if (!navigator.geolocation) { onError({ message: "Geolocation unavailable" }); return; }
      watchIdRef.current = navigator.geolocation.watchPosition(sendPosition, onError,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
      // Some mobile browsers pause watchPosition after returning from navigation.
      const sample = () => {
        if (!cancelled)
          navigator.geolocation.getCurrentPosition(sendPosition, onError,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
      };
      sample();
      pollId = window.setInterval(sample, Math.max(intervalMs, 15000));
      sampleOnResume = sample;
      document.addEventListener("visibilitychange", sample);
    };

    void ensureLocationPermission().then((ok) => {
      if (cancelled) return;
      if (!ok) { onError({ message: "Location permission denied" }); return; }
      if (!isNativeApp()) { startWeb(); return; }
      void BackgroundGeolocation.addWatcher({
        backgroundTitle: "Suivi de la mission Ligneo",
        backgroundMessage: "Votre trajet avec le véhicule est en cours.",
        distanceFilter: 5,
        stale: false,
        requestPermissions: true,
      }, (position, error) => {
        if (cancelled) return;
        if (error) onError(error);
        else if (position) void sendPosition({
          coords: { latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy, speed: position.speed, heading: position.bearing },
          timestamp: position.time ?? Date.now(),
        });
      }).then((id) => {
        if (cancelled) void BackgroundGeolocation.removeWatcher({ id });
        else nativeWatchId = id;
      }).catch((error) => {
        onError(error);
        // Existing installations without the newly bundled native service can
        // still report positions while the app remains open.
        if (!cancelled) startWeb();
      });
    });

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      if (sampleOnResume) document.removeEventListener("visibilitychange", sampleOnResume);
      if (nativeWatchId) void BackgroundGeolocation.removeWatcher({ id: nativeWatchId });
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, attributionId, sendPosition]);
}

