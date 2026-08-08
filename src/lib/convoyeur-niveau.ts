/**
 * Système de niveaux convoyeur : Débutant → Confirmé → Expert.
 * Le calcul officiel est fait côté base (recompute_convoyeur_niveau) ;
 * ces helpers servent uniquement à l'affichage et au verrouillage UI.
 */
export type NiveauCode = "debutant" | "confirme" | "expert";

export const NIVEAU_LABEL: Record<NiveauCode, string> = {
  debutant: "Débutant",
  confirme: "Confirmé",
  expert: "Expert",
};

export const NIVEAU_ORDER: NiveauCode[] = ["debutant", "confirme", "expert"];

/** Seuils alignés sur la fonction SQL recompute_convoyeur_niveau. */
export const NIVEAU_SEUILS = {
  confirme: { missions: 15, note: 4.0 },
  expert: { missions: 50, note: 4.7 },
} as const;

export function normalizeNiveau(v?: string | null): NiveauCode {
  const s = (v ?? "").toLowerCase();
  if (s.startsWith("exp")) return "expert";
  if (s.startsWith("conf")) return "confirme";
  return "debutant";
}

export function niveauRank(v?: string | null): number {
  return NIVEAU_ORDER.indexOf(normalizeNiveau(v)) + 1;
}

export function niveauLabel(v?: string | null): string {
  return NIVEAU_LABEL[normalizeNiveau(v)];
}

/** Le convoyeur peut-il accéder à une mission de niveau requis donné ? */
export function canAccessNiveau(
  driver?: string | null,
  required?: string | null,
): boolean {
  return niveauRank(driver) >= niveauRank(required);
}

export function niveauStyle(v?: string | null): string {
  switch (normalizeNiveau(v)) {
    case "expert":
      return "bg-amber-500/15 border-amber-400/50 text-amber-200";
    case "confirme":
      return "bg-sky-500/15 border-sky-400/50 text-sky-200";
    default:
      return "bg-emerald-500/15 border-emerald-400/50 text-emerald-200";
  }
}

export interface NiveauProgress {
  current: NiveauCode;
  next: NiveauCode | null;
  missionsDone: number;
  missionsTarget: number | null;
  noteMoyenne: number | null;
  noteTarget: number | null;
  /** 0 → 1 */
  ratio: number;
}

export function computeNiveauProgress(
  niveau: string | null | undefined,
  missionsDone: number,
  noteMoyenne: number | null,
): NiveauProgress {
  const current = normalizeNiveau(niveau);
  if (current === "expert") {
    return {
      current,
      next: null,
      missionsDone,
      missionsTarget: null,
      noteMoyenne,
      noteTarget: null,
      ratio: 1,
    };
  }
  const next: NiveauCode = current === "debutant" ? "confirme" : "expert";
  const seuil = NIVEAU_SEUILS[next];
  return {
    current,
    next,
    missionsDone,
    missionsTarget: seuil.missions,
    noteMoyenne,
    noteTarget: seuil.note,
    ratio: Math.max(0, Math.min(1, missionsDone / seuil.missions)),
  };
}
