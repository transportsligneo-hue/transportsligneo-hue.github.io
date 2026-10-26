/**
 * Journal de l'estimateur (Statistiques › Estimateur).
 * Enregistre chaque prix affiché (ville + département seulement, jamais l'adresse exacte),
 * puis le marque « demande envoyée » quand la personne envoie sa demande.
 */
import { useCallback, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { logEstimation, markEstimationRequested } from "@/lib/site-analytics.functions";
import { getVisitId } from "@/components/analytics/SiteAnalytics";

/** « 12 rue X, 37000 Tours, France » → { ville: "Tours", dept: "37" } */
export function cityAndDept(address: string): { ville: string | null; dept: string | null } {
  const a = (address || "").replace(/\s+/g, " ").trim();
  if (!a) return { ville: null, dept: null };
  const m = a.match(/\b((?:2[AB]|\d{2})\d{3})\b\s*([^,]*)/i);
  if (m) {
    const cp = m[1].toUpperCase();
    const dept = cp.startsWith("97") || cp.startsWith("98") ? cp.slice(0, 3) : cp.slice(0, 2);
    const ville = (m[2] || "").replace(/\bfrance\b/i, "").replace(/\bcedex\b.*$/i, "").trim();
    return { ville: ville ? ville.slice(0, 80) : null, dept };
  }
  const parts = a.split(",").map((p) => p.trim()).filter((p) => p && !/^france$/i.test(p) && !/^\d+\b/.test(p));
  const ville = parts.length ? parts[parts.length - 1] : null;
  return { ville: ville ? ville.slice(0, 80) : null, dept: null };
}

export function useEstimationLog(p: { departure: string; arrival: string; distance: number | null; vehicleType: string; option: string; price: number | null }) {
  const log = useServerFn(logEstimation);
  const mark = useServerFn(markEstimationRequested);
  const lastId = useRef<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const price = p.price;
    if (!p.departure || !p.arrival || !price || price <= 0) return;
    const key = [p.departure.trim().toLowerCase(), p.arrival.trim().toLowerCase(), p.vehicleType, p.option, Math.round(price)].join("|");
    if (seen.current.has(key)) return;
    // Attend que le prix soit stable (la personne a fini de taper)
    const t = window.setTimeout(() => {
      seen.current.add(key);
      void log({ data: {
        sid: getVisitId(),
        depart: cityAndDept(p.departure), arrivee: cityAndDept(p.arrival),
        km: p.distance != null ? Math.round(p.distance) : null,
        vehicule: p.vehicleType || undefined, option: p.option || undefined, prix: Math.round(price),
      } }).then((r: { id: string | null }) => { if (r?.id) lastId.current = r.id; }).catch(() => {});
    }, 2500);
    return () => window.clearTimeout(t);
  }, [p.departure, p.arrival, p.distance, p.vehicleType, p.option, p.price, log]);

  /** À appeler quand la demande de devis est envoyée. */
  return useCallback((devisId?: string | null) => {
    const id = lastId.current;
    if (!id) return;
    void mark({ data: { id, devisId: devisId ?? null } }).catch(() => {});
  }, [mark]);
}
