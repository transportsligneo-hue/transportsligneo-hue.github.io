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
}
