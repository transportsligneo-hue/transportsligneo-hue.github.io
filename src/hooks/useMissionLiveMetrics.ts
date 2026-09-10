/**
 * État partagé des métriques du suivi GPS live d'une mission.
 *
 * Reçoit les métriques calculées par la carte (aucun second calcul de
 * distance / ETA), enregistre l'ETA de référence côté serveur et expose
 * l'écart avec l'ETA actuel. L'alerte retard est déclenchée côté serveur.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { reportMissionEta } from "@/lib/mission-eta.functions";
import type { LiveMetricsSnapshot } from "@/components/map/types";

/** Intervalle minimum entre deux synchronisations d'ETA (anti-spam). */
const SYNC_EVERY_MS = 120_000;

export function useMissionLiveMetrics(attributionId: string | null) {
  const [metrics, setMetrics] = useState<LiveMetricsSnapshot | null>(null);
  const [initialEtaAt, setInitialEtaAt] = useState<string | null>(null);
  const [delayMinutes, setDelayMinutes] = useState<number | null>(null);
  const lastSyncRef = useRef(0);
  const report = useServerFn(reportMissionEta);

  const onMetrics = useCallback((m: LiveMetricsSnapshot | null) => setMetrics(m), []);

  useEffect(() => {
    if (!attributionId || !metrics?.etaAt || metrics.stale) return;
    const now = Date.now();
    if (now - lastSyncRef.current < SYNC_EVERY_MS) return;
    lastSyncRef.current = now;
    let cancelled = false;
    void (async () => {
      try {
        const res = await report({
          data: {
            attributionId,
            etaAt: metrics.etaAt.toISOString(),
            remainingKm: Math.round(metrics.remainingKm),
          },
        });
        if (cancelled) return;
        setInitialEtaAt(res.initialEtaAt);
        setDelayMinutes(res.delayMinutes);
      } catch {
        /* silencieux : le suivi reste fonctionnel sans référence */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attributionId, metrics, report]);

  return { metrics, onMetrics, initialEtaAt, delayMinutes };
}
