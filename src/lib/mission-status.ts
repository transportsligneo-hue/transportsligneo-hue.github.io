// Source unique de vérité pour les statuts d'attribution/mission
// Utilisé par admin + convoyeur + client pour un affichage cohérent.

export type MissionStatusKey =
  | "propose"           // Proposé au convoyeur, en attente de réponse
  | "accepte"           // Accepté par le convoyeur
  | "refusee"           // Refusé par le convoyeur
  | "en_cours"          // Mission en cours d'exécution
  | "en_attente_validation" // En attente validation admin (fin)
  | "validee"           // Validée par l'admin
  | "termine"           // Terminé
  | "publie"            // Publié au catalogue
  | "brouillon"         // Brouillon admin
  | "attribue"          // Attribué (mission planifiée)
  | "expire"            // Proposition expirée
  | "annule";

export interface MissionStatusMeta {
  label: string;
  short: string;
  tone: "amber" | "emerald" | "red" | "blue" | "violet" | "slate" | "gold";
  pulse?: boolean;
  description?: string;
}

export const MISSION_STATUS: Record<MissionStatusKey, MissionStatusMeta> = {
  propose: { label: "En attente de réponse du convoyeur", short: "Proposée", tone: "amber", pulse: true, description: "Le convoyeur doit accepter ou refuser." },
  accepte: { label: "Acceptée par le convoyeur", short: "Acceptée", tone: "emerald" },
  refusee: { label: "Refusée par le convoyeur", short: "Refusée", tone: "red", description: "À réattribuer ou publier au catalogue." },
  en_cours: { label: "Mission en cours", short: "En cours", tone: "blue", pulse: true },
  en_attente_validation: { label: "En attente de validation admin", short: "À valider", tone: "amber" },
  termine: { label: "Terminée", short: "Terminée", tone: "emerald" },
  publie: { label: "Publiée au catalogue", short: "Au catalogue", tone: "blue", description: "Visible par les convoyeurs validés." },
  brouillon: { label: "Brouillon", short: "Brouillon", tone: "slate" },
  attribue: { label: "Mission planifiée", short: "Planifiée", tone: "emerald" },
  expire: { label: "Proposition expirée", short: "Expirée", tone: "slate" },
  annule: { label: "Annulée", short: "Annulée", tone: "red" },
};

export function getMissionStatus(key: string | null | undefined): MissionStatusMeta {
  if (!key) return { label: "—", short: "—", tone: "slate" };
  return MISSION_STATUS[key as MissionStatusKey] ?? { label: key, short: key, tone: "slate" };
}

export const TONE_CLASSES: Record<MissionStatusMeta["tone"], string> = {
  amber: "bg-amber-50 text-amber-800 border-amber-200 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-800 border-emerald-200 ring-emerald-100",
  red: "bg-red-50 text-red-700 border-red-200 ring-red-100",
  blue: "bg-blue-50 text-blue-800 border-blue-200 ring-blue-100",
  violet: "bg-violet-50 text-violet-800 border-violet-200 ring-violet-100",
  slate: "bg-slate-100 text-slate-700 border-slate-200 ring-slate-100",
  gold: "bg-[#fdf6e3] text-[#8a6a1a] border-[#e7c76a]/60 ring-[#e7c76a]/30",
};
