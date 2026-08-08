import { normalizeNiveau, niveauLabel, type NiveauCode } from "@/lib/convoyeur-niveau";

export type MissionLevel = "Débutant" | "Confirmé" | "Expert";

interface Input {
  distanceKm?: number | null;
  urgence?: string | null;
}

/**
 * Règle métier locale pour afficher un niveau minimum indicatif
 * (côté client uniquement, aucune logique BDD modifiée).
 */
export function inferMissionLevel({ distanceKm, urgence }: Input): MissionLevel {
  const isUrgent = urgence === "urgent" || urgence === "immediat";
  const d = distanceKm ?? 0;
  if (d > 600 || isUrgent) return "Expert";
  if (d >= 200) return "Confirmé";
  return "Débutant";
}

/**
 * Niveau MINIMUM REQUIS PAR LA MISSION (à ne pas confondre avec le niveau
 * du convoyeur). Priorité au champ `niveau_requis` défini par l'admin ;
 * à défaut, déduction depuis la distance / l'urgence.
 */
export function missionRequiredNiveau(input: {
  niveau_requis?: string | null;
  distance_km?: number | null;
  urgence?: string | null;
}): NiveauCode {
  const explicit = normalizeNiveau(input.niveau_requis);
  if (explicit !== "debutant") return explicit;
  const inferred = inferMissionLevel({
    distanceKm: input.distance_km,
    urgence: input.urgence,
  });
  return inferred === "Expert" ? "expert" : inferred === "Confirmé" ? "confirme" : "debutant";
}

export function missionLevelLabel(input: Parameters<typeof missionRequiredNiveau>[0]): MissionLevel {
  return niveauLabel(missionRequiredNiveau(input)) as MissionLevel;
}

export function missionLevelStyle(level: MissionLevel | NiveauCode | string): string {
  switch (normalizeNiveau(level)) {
    case "expert":
      return "bg-amber-500/15 border-amber-400/50 text-amber-200";
    case "confirme":
      return "bg-sky-500/15 border-sky-400/50 text-sky-200";
    default:
      return "bg-emerald-500/15 border-emerald-400/50 text-emerald-200";
  }
}
