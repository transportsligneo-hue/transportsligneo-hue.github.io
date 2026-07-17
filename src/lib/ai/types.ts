/**
 * Types partagés pour l'assistant IA.
 * Tous les composants et server fns IA passent par ces types.
 */

export type AiCapability =
  | "ocr_documents"
  | "ocr_odometer"
  | "detect_fuel_level"
  | "detect_battery_level"
  | "detect_warning_lights"
  | "detect_scratches"
  | "detect_dents"
  | "detect_impacts"
  | "detect_rims"
  | "detect_windshield"
  | "detect_mirrors"
  | "detect_lights"
  | "detect_equipment"
  | "compare_departure_arrival"
  | "auto_report"
  | "mission_prefill"
  | "smart_suggestions"
  | "photo_assistant";

export type AssistanceLevel = "minimal" | "standard" | "avance";

export type AiSettings = {
  ai_enabled: boolean;
  assistance_level: AssistanceLevel;
  model_overrides: Record<string, string>;
} & Record<AiCapability, boolean>;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  ai_enabled: true,
  assistance_level: "standard",
  model_overrides: {},
  ocr_documents: true,
  ocr_odometer: true,
  detect_fuel_level: true,
  detect_battery_level: true,
  detect_warning_lights: true,
  detect_scratches: true,
  detect_dents: true,
  detect_impacts: true,
  detect_rims: true,
  detect_windshield: true,
  detect_mirrors: true,
  detect_lights: true,
  detect_equipment: true,
  compare_departure_arrival: true,
  auto_report: true,
  mission_prefill: true,
  smart_suggestions: true,
  photo_assistant: true,
};

export const AI_CAPABILITIES: { key: AiCapability; label: string; group: string }[] = [
  { key: "ocr_documents", label: "OCR Documents", group: "OCR & Extraction" },
  { key: "ocr_odometer", label: "OCR Compteur kilométrique", group: "OCR & Extraction" },
  { key: "mission_prefill", label: "Pré-remplissage de mission", group: "OCR & Extraction" },

  { key: "detect_fuel_level", label: "Niveau carburant", group: "Tableau de bord" },
  { key: "detect_battery_level", label: "Niveau batterie", group: "Tableau de bord" },
  { key: "detect_warning_lights", label: "Voyants allumés", group: "Tableau de bord" },

  { key: "detect_scratches", label: "Rayures", group: "Détection défauts" },
  { key: "detect_dents", label: "Bosses", group: "Détection défauts" },
  { key: "detect_impacts", label: "Impacts", group: "Détection défauts" },
  { key: "detect_rims", label: "Jantes abîmées", group: "Détection défauts" },
  { key: "detect_windshield", label: "Fissures pare-brise", group: "Détection défauts" },
  { key: "detect_mirrors", label: "Rétroviseurs endommagés", group: "Détection défauts" },
  { key: "detect_lights", label: "Feux endommagés", group: "Détection défauts" },

  { key: "detect_equipment", label: "Équipements intérieur/coffre", group: "Équipements" },

  { key: "compare_departure_arrival", label: "Comparaison Départ / Arrivée", group: "Comparaison & Rapport" },
  { key: "auto_report", label: "Génération auto du rapport", group: "Comparaison & Rapport" },

  { key: "smart_suggestions", label: "Suggestions intelligentes", group: "Assistant" },
  { key: "photo_assistant", label: "Assistant de prise de photos", group: "Assistant" },
];

/** Bounding box normalisée (0-1). */
export type BBox = { x: number; y: number; w: number; h: number };

export type DamageLabel =
  | "rayure" | "bosse" | "impact" | "eclat_peinture"
  | "jante_abimee" | "pare_brise_fissure" | "optique_cassee"
  | "retroviseur_endommage" | "pare_chocs" | "capot" | "aile"
  | "portiere" | "coffre" | "toit" | "bas_de_caisse";

export type DamageDetection = {
  label: DamageLabel;
  confidence: number; // 0-1
  bbox: BBox;
  zone?: string;
  description?: string;
};

export type PhotoAnalysis = {
  detections: DamageDetection[];
  overall_quality: "good" | "average" | "poor";
  warnings: string[];
};

export type DashboardReading = {
  kilometrage?: string;
  autonomie_km?: string;
  fuel_percent?: number | null;
  battery_percent?: number | null;
  temperature?: string;
  warning_lights: string[];
  warnings: string[];
};

export type EquipmentDetection = {
  equipements_presents: string[];
  equipements_absents: string[];
  equipements_incertains: string[];
  warnings: string[];
};

export type PhotoQuality = {
  is_blurry: boolean;
  is_too_dark: boolean;
  is_badly_framed: boolean;
  advice: string[];
};

export type EdlComparison = {
  new_damages: DamageDetection[];
  removed_damages: DamageDetection[];
  summary: string;
};
