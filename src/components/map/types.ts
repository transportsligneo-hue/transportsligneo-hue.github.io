export interface LiveGpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy?: number | null;
  speed?: number | null;
}

export type MapPlace = { lat: number; lng: number; label?: string } | string | null | undefined;

export interface LiveMissionMapProps {
  /** Historique GPS (ordre chronologique croissant) */
  points: LiveGpsPoint[];
  /** Adresse ou coordonnées de départ */
  origin?: MapPlace;
  /** Adresse ou coordonnées d'arrivée */
  destination?: MapPlace;
  className?: string;
  /** Masquer la carte d'informations flottante */
  hideOverlay?: boolean;
  /** Libellé affiché dans l'overlay */
  title?: string;
  /** Mode flotte : dernières positions de plusieurs missions (marqueurs voiture) */
  fleet?: Array<{ lat: number; lng: number; label?: string; stale?: boolean }>;
  /** Tableau d'exploitation : conserver la vue mondiale même avec des véhicules visibles. */
  worldOverview?: boolean;
  /**
   * Visibilité des données sensibles.
   * `admin` : vitesse km/h + horodatage précis du dernier signal.
   * `client` (défaut) : uniquement statut en route / à l'arrêt.
   */
  role?: "admin" | "client";
  /** Remonte les métriques temps réel au parent (progression, ETA, arrêts…). */
  onMetrics?: (m: LiveMetricsSnapshot | null) => void;
  /** Écart en minutes avec l'ETA de référence (affiché à côté de l'ETA actuel). */
  etaDeltaMin?: number | null;
  /** Mission terminée : masque les alertes de signal et affiche une carte de synthèse. */
  completed?: boolean;
  /** Plaque affichée sur la carte de synthèse (mission terminée). */
  completedPlaque?: string | null;
}

/** Instantané des métriques calculées par la carte (source unique de vérité). */
export interface LiveMetricsSnapshot {
  remainingKm: number;
  totalKm: number;
  /** Progression du trajet en % (0-100). */
  progress: number;
  speedKmh: number;
  etaMin: number;
  etaAt: Date;
  /** Âge du dernier signal GPS en minutes (null si aucune position). */
  signalAgeMin: number | null;
  /** Signal perdu (aucune position depuis plus de 15 min). */
  stale: boolean;
  /** Véhicule en mouvement. */
  moving: boolean;
  /** Temps d'arrêt cumulé depuis le début de la mission (minutes). */
  stoppedMin: number;
  /** Prochaine étape clé (frontière ou pause). */
  nextMilestone: { kind: "frontiere" | "pause"; label: string; inMinutes: number | null } | null;
}
