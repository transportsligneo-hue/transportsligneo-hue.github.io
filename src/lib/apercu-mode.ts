/**
 * Mode "aperçu" : permet à un admin d'ouvrir les espaces client / pro
 * dans une iframe sans être redirigé vers son propre espace.
 * Les données restent celles de la session en cours (RLS inchangée).
 */
export function isApercuMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("apercu") === "1";
}

export function apercuAccountType(): "b2b_standard" | "flotte" | null {
  if (typeof window === "undefined") return null;
  const t = new URLSearchParams(window.location.search).get("apercu_type");
  return t === "flotte" || t === "b2b_standard" ? t : null;
}
