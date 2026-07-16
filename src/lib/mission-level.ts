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

export function missionLevelStyle(level: MissionLevel): string {
  switch (level) {
    case "Expert":
      return "bg-amber-500/15 border-amber-400/50 text-amber-200";
    case "Confirmé":
      return "bg-sky-500/15 border-sky-400/50 text-sky-200";
    default:
      return "bg-emerald-500/15 border-emerald-400/50 text-emerald-200";
  }
}
