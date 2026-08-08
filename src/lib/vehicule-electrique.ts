/**
 * Détection véhicule électrique / hybride rechargeable.
 * Source unique de vérité utilisée par : badges de mission (convoyeur, admin,
 * client) et étape EDL conditionnelle "Câble de recharge".
 */

export type MotorisationChoice = "oui" | "non" | "hybride";

/** Électrique pur OU hybride rechargeable (les deux ont des câbles de recharge). */
export function isElectricEnergie(value?: string | null): boolean {
  if (!value) return false;
  return /electr|électr|\bev\b|phev|plug.?in|hybride?\s*rechargeable/i.test(value);
}

/** Hybride non rechargeable (pas de câble). */
export function isHybrideEnergie(value?: string | null): boolean {
  if (!value) return false;
  return /hybr/i.test(value) && !isElectricEnergie(value);
}

/** Première valeur non vide parmi plusieurs champs énergie/carburant possibles. */
export function resolveEnergie(...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

/** Déduit la motorisation depuis une marque/modèle connus 100% électriques. */
const EV_MODEL_PATTERNS = [
  /\btesla\b/i,
  /\bzoe\b/i,
  /\bmegane\s*e[-\s]?tech\b/i,
  /\bscenic\s*e[-\s]?tech\b/i,
  /\bid\.?\s?[3457]\b/i,
  /\be[-\s]?tron\b/i,
  /\bi[3478]\b/i,
  /\bix[1-3]?\b/i,
  /\beqa|eqb|eqc|eqe|eqs|eqv\b/i,
  /\bleaf\b/i,
  /\bariya\b/i,
  /\bioniq\s?[56]\b/i,
  /\bkona\s*electric\b/i,
  /\bev6\b/i,
  /\bniro\s*ev\b/i,
  /\bmustang\s*mach[-\s]?e\b/i,
  /\be[-\s]?208\b/i,
  /\be[-\s]?2008\b/i,
  /\be[-\s]?c4\b/i,
  /\bspring\b/i,
  /\bbyd\b/i,
  /\bmg\s?[45]\b/i,
];

export function guessElectricFromModel(marque?: string | null, modele?: string | null): boolean {
  const s = `${marque ?? ""} ${modele ?? ""}`.trim();
  if (!s) return false;
  return EV_MODEL_PATTERNS.some((re) => re.test(s));
}

/** Motorisation pré-cochée dans les formulaires de création. */
export function guessMotorisation(params: {
  energie?: string | null;
  marque?: string | null;
  modele?: string | null;
}): MotorisationChoice {
  if (isElectricEnergie(params.energie)) return "oui";
  if (isHybrideEnergie(params.energie)) return "hybride";
  if (guessElectricFromModel(params.marque, params.modele)) return "oui";
  return "non";
}

/** Valeur "carburant" persistée en base selon le choix explicite du formulaire. */
export function motorisationToCarburant(
  choice: MotorisationChoice,
  fallback?: string | null,
): string | null {
  if (choice === "oui") return "electrique";
  if (choice === "hybride") return "hybride_rechargeable";
  return fallback && !isElectricEnergie(fallback) ? fallback : null;
}
