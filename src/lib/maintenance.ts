import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MaintenanceSettings {
  enabled: boolean;
  /** "banner" : le site reste utilisable · "full" : page de maintenance pour les visiteurs */
  mode: "banner" | "full";
  site: boolean;
  driver: boolean;
  title: string;
  reason: string;
  return_at: string | null;
  admin_bypass: boolean;
  keep_tracking: boolean;
}

export const MAINTENANCE_KEY = "maintenance_mode";

export const DEFAULT_MAINTENANCE: MaintenanceSettings = {
  enabled: false,
  mode: "banner",
  site: true,
  driver: true,
  title: "Maintenance en cours",
  reason: "",
  return_at: null,
  admin_bypass: true,
  keep_tracking: true,
};

export function normalizeMaintenance(raw: unknown): MaintenanceSettings {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<MaintenanceSettings>;
  return {
    ...DEFAULT_MAINTENANCE,
    ...v,
    mode: v.mode === "full" ? "full" : "banner",
    title: (v.title ?? "").toString().trim() || DEFAULT_MAINTENANCE.title,
    reason: (v.reason ?? "").toString(),
    return_at: v.return_at || null,
  };
}

/** Routes de l'application Driver (thème vert). */
export function isDriverPath(pathname: string): boolean {
  return pathname.startsWith("/convoyeur") || pathname.startsWith("/inscription-convoyeur") || pathname.startsWith("/invitation-convoyeur");
}

/** Toujours accessibles, même en maintenance complète. */
export function isMaintenanceExempt(pathname: string, s: MaintenanceSettings): boolean {
  if (pathname.startsWith("/admin")) return true;
  if (["/login", "/mot-de-passe-oublie", "/reset-password"].some((p) => pathname.startsWith(p))) return true;
  if (s.keep_tracking && pathname.startsWith("/suivi")) return true;
  return false;
}

export function formatReturn(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  return `${day} à ${hm}`;
}

/** Lit le réglage (fonction publique), le rafraîchit toutes les 60 s et au retour sur l'onglet. */
export function useMaintenance(): MaintenanceSettings | null {
  const [state, setState] = useState<MaintenanceSettings | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (n: string) => Promise<{ data: unknown; error: unknown }> }).rpc("get_maintenance_status");
        if (!alive || error) return;
        setState(normalizeMaintenance(data));
      } catch { /* silencieux : sans réponse, le site reste ouvert */ }
    };
    void load();
    const iv = window.setInterval(load, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("ligneo:maintenance-changed", load);
    return () => { alive = false; window.clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("ligneo:maintenance-changed", load); };
  }, []);
  return state;
}
