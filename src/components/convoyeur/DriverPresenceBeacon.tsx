/**
 * Appli Driver · signale à l'admin que le convoyeur est en ligne (toutes les 30 s, appli ouverte).
 * Envoie : version de l'appli et position du téléphone SI la localisation est déjà autorisée
 * (on ne déclenche jamais de demande d'autorisation ici). N'affiche rien.
 * Table convoyeur_presence + fonction driver_heartbeat (migration 20261026000600).
 */
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { rpc: (f: string, a: object) => Promise<{ error: unknown }> };
const EVERY_MS = 30_000;

let cachedVersion: string | null | undefined;
async function appVersion(): Promise<string | null> {
  if (cachedVersion !== undefined) return cachedVersion;
  try {
    if (!Capacitor.isNativePlatform()) { cachedVersion = null; return null; }
    const { App } = await import("@capacitor/app");
    cachedVersion = String((await App.getInfo()).version || "") || null;
  } catch { cachedVersion = null; }
  return cachedVersion;
}

async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  try {
    // Uniquement si l'autorisation est déjà donnée : jamais de fenêtre de demande surprise.
    const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName }).catch(() => null);
    if (perm && perm.state !== "granted") return null;
  } catch { /* API absente : on tente quand même sans attendre longtemps */ }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  });
}

export function DriverPresenceBeacon() {
  useEffect(() => {
    let stopped = false;
    let busy = false;
    const beat = async () => {
      if (stopped || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const [version, pos] = await Promise.all([appVersion(), currentPosition()]);
        const native = Capacitor.isNativePlatform() || /LigneoDriverApp/i.test(navigator.userAgent);
        const { error } = await db.rpc("driver_heartbeat", {
          p_version: version, p_native: native, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null,
        });
        if (error) console.warn("[présence] signal non envoyé :", error);
      } catch (e) {
        console.warn("[présence] signal non envoyé :", e);
      } finally { busy = false; }
    };
    void beat();
    const iv = window.setInterval(() => void beat(), EVERY_MS);
    const onVis = () => { if (document.visibilityState === "visible") void beat(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; window.clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return null;
}
