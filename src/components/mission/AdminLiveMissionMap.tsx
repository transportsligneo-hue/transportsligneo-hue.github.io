import { LiveMissionMap } from "@/components/map/LiveMissionMap";
import { useMissionLiveMetrics } from "@/hooks/useMissionLiveMetrics";
import type { LiveGpsPoint, MapPlace } from "@/components/map/types";

/**
 * Carte de suivi live côté exploitation (admin) : vitesse et fraîcheur du
 * signal visibles, écart avec l'ETA de référence, alerte retard automatique.
 */
export function AdminLiveMissionMap({
  attributionId,
  points,
  origin,
  destination,
  title,
  className,
  completed = false,
  completedPlaque = null,
}: {
  attributionId: string;
  points: LiveGpsPoint[];
  origin?: MapPlace;
  destination?: MapPlace;
  title?: string;
  className?: string;
  /** Mission terminée : carte de synthèse à la place des alertes de signal. */
  completed?: boolean;
  completedPlaque?: string | null;
}) {
  const { onMetrics, delayMinutes } = useMissionLiveMetrics(attributionId);
  return (
    <LiveMissionMap
      role="admin"
      onMetrics={onMetrics}
      etaDeltaMin={delayMinutes}
      points={points}
      origin={origin}
      destination={destination}
      title={title}
      className={className}
      completed={completed}
      completedPlaque={completedPlaque}
    />
  );
}
