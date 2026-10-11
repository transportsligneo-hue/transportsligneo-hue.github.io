/** Format officiel SIV : AA-123-BB. Les anciennes plaques et plaques étrangères restent libres. */
export const SIV_RE = /^[A-Z]{2}-\d{3}-[A-Z]{2}$/;
export const FNI_RE = /^\d{1,4}\s?[A-Z]{1,3}\s?(\d{2,3}|2A|2B)$/;

/** Majuscules + tirets automatiques au format SIV (FG482KL devient FG-482-KL). */
export function formatSivPlate(raw: string): string {
  const c = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  const out: string[] = [];
  for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    const wantLetter = i < 2 || i > 4;
    if (wantLetter ? !/[A-Z]/.test(ch) : !/\d/.test(ch)) return out.join("").replace(/-$/, "");
    if (i === 2 || i === 5) out.push("-");
    out.push(ch);
  }
  return out.join("");
}

/** Normalisation d'affichage, sans modifier la donnée stockée. */
export function displayPlate(raw: string | null | undefined): string {
  const c = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(c)) return `${c.slice(0, 2)}-${c.slice(2, 5)}-${c.slice(5)}`;
  return String(raw ?? "").toUpperCase().trim();
}

export function plateKey(raw: string | null | undefined): string {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type PlateValidity = "empty" | "valid" | "legacy" | "invalid";
export function plateValidity(value: string, foreign = false): PlateValidity {
  const v = value.trim().toUpperCase();
  if (!v) return "empty";
  if (SIV_RE.test(v)) return "valid";
  if (foreign || FNI_RE.test(v)) return "legacy";
  return "invalid";
}
