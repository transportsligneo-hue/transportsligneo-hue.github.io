/**
 * Métriques complémentaires du suivi GPS temps réel.
 *
 * Fonctions pures (aucun appel réseau) : fraîcheur du signal, statut
 * en route / à l'arrêt, temps d'arrêt cumulé, temps de conduite continue.
 * Le calcul de distance restante / ETA existant n'est pas modifié.
 */
import { haversineKm } from "@/lib/geo/haversine";

export interface LivePointLite {
  latitude: number;
  longitude: number;
  recorded_at: string;
  speed?: number | null;
}

/** Au-delà de ce délai sans position, le signal est considéré comme perdu (envoi ~4 s en route, ~30 s à l'arrêt). */
export const SIGNAL_STALE_MIN = 15;

/** Seuil de déplacement (km) entre deux points pour considérer le véhicule en mouvement. */
const MOVE_KM = 0.25;

/** Un écart de plus de 45 min entre deux points n'est pas comptabilisé comme un arrêt mesuré. */
const MAX_GAP_MIN = 45;

/** Âge du dernier signal GPS, en minutes (null si aucune position). */
export function signalAgeMinutes(last: LivePointLite | null | undefined, now = Date.now()): number | null {
  if (!last?.recorded_at) return null;
  const t = new Date(last.recorded_at).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 60_000));
}

/** Temps total passé à l'arrêt depuis le début de la mission, en minutes. */
export function stoppedMinutes(points: LivePointLite[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dtMin = (new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()) / 60_000;
    if (!Number.isFinite(dtMin) || dtMin <= 0 || dtMin > MAX_GAP_MIN) continue;
    const km = haversineKm(
      { lat: a.latitude, lng: a.longitude },
      { lat: b.latitude, lng: b.longitude },
    );
    if (km < MOVE_KM) total += dtMin;
  }
  return Math.round(total);
}

/** Temps de conduite continue depuis le dernier arrêt significatif (>= 10 min), en minutes. */
export function drivingSinceLastStopMinutes(points: LivePointLite[]): number | null {
  if (points.length < 2) return null;
  let lastStopEnd: number | null = null;
  let runStart: number | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const ta = new Date(a.recorded_at).getTime();
    const tb = new Date(b.recorded_at).getTime();
    const dtMin = (tb - ta) / 60_000;
    if (!Number.isFinite(dtMin) || dtMin <= 0) continue;
    const km = haversineKm(
      { lat: a.latitude, lng: a.longitude },
      { lat: b.latitude, lng: b.longitude },
    );
    if (km < MOVE_KM && dtMin >= 10 && dtMin <= MAX_GAP_MIN) {
      lastStopEnd = tb;
      runStart = null;
    } else if (runStart === null) {
      runStart = lastStopEnd ?? ta;
    }
  }
  const start = runStart ?? lastStopEnd;
  if (start === null) return null;
  const lastT = new Date(points[points.length - 1].recorded_at).getTime();
  return Math.max(0, Math.round((lastT - start) / 60_000));
}

/** "2 min", "1 h 20" */
export function formatMinutesShort(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "non disponible";
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, "0")}`;
}

/** Écart signé en minutes entre l'ETA actuel et l'ETA de référence. */
export function etaDeltaMinutes(currentEta: Date | null, initialEtaIso: string | null): number | null {
  if (!currentEta || !initialEtaIso) return null;
  const ref = new Date(initialEtaIso).getTime();
  if (Number.isNaN(ref)) return null;
  return Math.round((currentEta.getTime() - ref) / 60_000);
}

/** "+38 min" / "-12 min" */
export function formatDelta(deltaMin: number | null): string | null {
  if (deltaMin == null || Math.abs(deltaMin) < 2) return null;
  const sign = deltaMin > 0 ? "+" : "−";
  return `${sign}${formatMinutesShort(Math.abs(deltaMin))}`;
}
