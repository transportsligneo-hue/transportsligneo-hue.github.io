import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LivraisonTime = { heure: string | null; date: string | null };

/** Heures de livraison (et date si différente de l'enlèvement) des missions du convoyeur. */
export function useLivraisonTimes(ids: Array<string | null | undefined>) {
  const [map, setMap] = useState<Record<string, LivraisonTime>>({});
  const key = [...new Set(ids.filter(Boolean) as string[])].sort().join(",");
  useEffect(() => {
    if (!key) return;
    let off = false;
    (async () => {
      try {
        const { data } = await (supabase as unknown as { rpc: (n: string, a: unknown) => Promise<{ data: unknown }> })
          .rpc("driver_livraison_times", { _trajet_ids: key.split(",") });
        if (off || !Array.isArray(data)) return;
        const out: Record<string, LivraisonTime> = {};
        for (const r of data as Array<{ trajet_id: string; heure_livraison: string | null; date_livraison: string | null }>) {
          out[r.trajet_id] = { heure: r.heure_livraison, date: r.date_livraison };
        }
        setMap(out);
      } catch { /* l'heure de livraison est facultative */ }
    })();
    return () => { off = true; };
  }, [key]);
  return map;
}

export const hhmm = (h: string | null | undefined) => (h ? h.slice(0, 5).replace(":", "h") : null);

/** « 14h00 » ou « sam. 7 nov. · 14h00 » si la livraison n'a pas lieu le jour de l'enlèvement. */
export function livraisonLabel(l: LivraisonTime | undefined, pickupDate: string | null | undefined) {
  const h = hhmm(l?.heure);
  if (!h) return null;
  const d = l?.date?.slice(0, 10);
  if (d && pickupDate && d !== pickupDate.slice(0, 10)) {
    return `${new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · ${h}`;
  }
  return h;
}
