/**
 * mission-alerts — métadonnées partagées du système d'alertes opérationnelles.
 */

export type AlertSeverity = "info" | "attention" | "critique";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export type AlertType =
  | "acceptee_non_demarree"
  | "creneau_enlevement_depasse"
  | "trajet_enlevement_long"
  | "gps_silence"
  | "edl_depart_manquant"
  | "creneau_livraison_depasse"
  | "incident_non_pris_en_charge";

export interface MissionAlertRow {
  id: string;
  attribution_id: string;
  alert_type: string;
  severity: AlertSeverity;
  base_severity: AlertSeverity;
  status: AlertStatus;
  titre: string;
  message: string | null;
  details: Record<string, unknown>;
  triggered_at: string;
  escalated_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export const ALERT_TYPES: Record<
  AlertType,
  { label: string; description: string; unite: string; defautSeuil: number }
> = {
  acceptee_non_demarree: {
    label: "Mission acceptée non démarrée",
    description: "Le convoyeur a accepté mais n'a pas démarré son trajet vers le véhicule.",
    unite: "minutes",
    defautSeuil: 30,
  },
  creneau_enlevement_depasse: {
    label: "Créneau d'enlèvement dépassé",
    description: "L'heure d'enlèvement prévue est passée sans prise en charge.",
    unite: "minutes",
    defautSeuil: 0,
  },
  trajet_enlevement_long: {
    label: "Trajet vers le véhicule trop long",
    description: "Le convoyeur met anormalement longtemps à rejoindre le point d'enlèvement.",
    unite: "minutes",
    defautSeuil: 120,
  },
  gps_silence: {
    label: "Silence GPS",
    description: "Aucune position reçue pendant une mission en cours.",
    unite: "minutes",
    defautSeuil: 20,
  },
  edl_depart_manquant: {
    label: "État des lieux de départ manquant",
    description: "Véhicule pris en charge sans EDL de départ enregistré.",
    unite: "minutes",
    defautSeuil: 15,
  },
  creneau_livraison_depasse: {
    label: "Créneau de livraison dépassé",
    description: "La livraison n'a pas été effectuée dans le délai prévu.",
    unite: "minutes",
    defautSeuil: 480,
  },
  incident_non_pris_en_charge: {
    label: "Incident non traité",
    description: "Un incident déclaré par le convoyeur attend une réponse admin.",
    unite: "minutes",
    defautSeuil: 10,
  },
};

export function alertTypeLabel(type: string): string {
  return ALERT_TYPES[type as AlertType]?.label ?? type;
}

export const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; dot: string; chip: string; card: string; order: number }
> = {
  critique: {
    label: "Critique",
    dot: "bg-[#dc2626]",
    chip: "bg-red-50 text-red-700 border-red-200",
    card: "border-red-200 bg-red-50/40",
    order: 3,
  },
  attention: {
    label: "Attention",
    dot: "bg-[#f59e0b]",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    card: "border-amber-200 bg-amber-50/40",
    order: 2,
  },
  info: {
    label: "Info",
    dot: "bg-[#2f5fff]",
    chip: "bg-blue-50 text-[#2f5fff] border-blue-200",
    card: "border-blue-200 bg-blue-50/30",
    order: 1,
  },
};

export interface AlertTypeConfig {
  enabled: boolean;
  seuil: number;
  severite: AlertSeverity;
}

export interface AlertesConfig {
  enabled: boolean;
  escalade_minutes: number;
  types: Record<string, AlertTypeConfig>;
}

export const DEFAULT_ALERTES_CONFIG: AlertesConfig = {
  enabled: true,
  escalade_minutes: 30,
  types: Object.fromEntries(
    Object.entries(ALERT_TYPES).map(([k, v]) => [
      k,
      { enabled: true, seuil: v.defautSeuil, severite: "attention" as AlertSeverity },
    ]),
  ),
};

/** Durée écoulée depuis un timestamp, format court FR. */
export function sinceLabel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `il y a ${h} h ${String(mins % 60).padStart(2, "0")}`;
  return `il y a ${Math.floor(h / 24)} j`;
}
