/**
 * Source de vérité unique pour la saisie / validation des VIN dans toute la plateforme
 * (estimateur public, dashboard client, formulaires flotte B2B, admin).
 *
 * Le rapprochement automatique des bons de commande CAT (PO K2) repose entièrement
 * sur le VIN : un VIN mal saisi = un PO qui ne se rapproche jamais.
 */

/** Caractères autorisés dans un VIN ISO 3779 (I, O et Q sont interdits). */
const VIN_ALLOWED = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Nettoie une saisie utilisateur : majuscules, sans espaces ni tirets. */
export function normalizeVin(input: string | null | undefined): string {
  return (input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Format strict : 17 caractères alphanumériques, hors I/O/Q. */
export function isValidVinFormat(input: string | null | undefined): boolean {
  return VIN_ALLOWED.test(normalizeVin(input));
}

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Checksum ISO 3779 (9e caractère). Obligatoire en Amérique du Nord,
 * facultatif chez les constructeurs européens → utilisé comme simple
 * avertissement, jamais comme blocage.
 */
export function vinChecksumValid(input: string | null | undefined): boolean {
  const vin = normalizeVin(input);
  if (!VIN_ALLOWED.test(vin)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i]!;
    const value = /\d/.test(c) ? Number(c) : (TRANSLIT[c] ?? 0);
    sum += value * WEIGHTS[i]!;
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  return vin[8] === expected;
}

export type VinValidation = {
  /** VIN nettoyé (à enregistrer en base). */
  value: string;
  /** true si le format est correct (ou si le champ est vide et non requis). */
  valid: boolean;
  /** Message bloquant. */
  error?: string;
  /** Message non bloquant (checksum douteux). */
  warning?: string;
};

/**
 * Validation partagée par tous les points d'entrée.
 * @param required true dans l'admin et les formulaires flotte (VIN bloquant).
 */
export function validateVin(input: string | null | undefined, required = false): VinValidation {
  const value = normalizeVin(input);
  if (!value) {
    return required
      ? { value, valid: false, error: "VIN obligatoire (17 caractères)" }
      : { value, valid: true };
  }
  if (value.length !== 17) {
    return { value, valid: false, error: `VIN incomplet : ${value.length}/17 caractères` };
  }
  if (!VIN_ALLOWED.test(value)) {
    return { value, valid: false, error: "VIN invalide : les lettres I, O et Q ne sont pas autorisées" };
  }
  if (!vinChecksumValid(value)) {
    return { value, valid: true, warning: "Clé de contrôle inhabituelle — vérifie la saisie" };
  }
  return { value, valid: true };
}

/** Formatage lisible (groupes de caractères) pour l'affichage. */
export function formatVin(input: string | null | undefined): string {
  const v = normalizeVin(input);
  if (v.length !== 17) return v;
  return `${v.slice(0, 3)} ${v.slice(3, 9)} ${v.slice(9)}`;
}

/** Deux VIN désignent-ils le même véhicule ? (comparaison normalisée) */
export function sameVin(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeVin(a);
  const y = normalizeVin(b);
  return !!x && x === y;
}
