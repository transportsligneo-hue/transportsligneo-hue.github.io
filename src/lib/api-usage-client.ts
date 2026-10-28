/** Compteur d'usage des API payantes appelées depuis le navigateur (Google Places / Distance Matrix). */
import { supabase } from "@/integrations/supabase/client";

type Service = "places_session" | "distance_matrix";
const pending: Record<string, number> = {};
let timer: ReturnType<typeof setTimeout> | null = null;

export function logApiUsage(service: Service, units = 1) {
  if (typeof window === "undefined") return;
  pending[service] = (pending[service] ?? 0) + units;
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    const batch = { ...pending };
    for (const k of Object.keys(pending)) delete pending[k];
    for (const [svc, n] of Object.entries(batch)) {
      try { await (supabase as any).rpc("log_api_usage", { _service: svc, _units: n }); } catch { /* jamais bloquant */ }
    }
  }, 3000);
}
