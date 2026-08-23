/**
 * Suivi local du "dernier passage" de l'admin sur la page Demandes.
 * Sert à afficher un badge de nouveautés dans la barre latérale et à
 * surligner les demandes réellement nouvelles dans la liste.
 */
const KEY = "ligneo_admin_demandes_seen_at";
export const DEMANDES_SEEN_EVENT = "ligneo:demandes-seen";

export function getDemandesSeenAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markDemandesSeen(at: Date = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, at.toISOString());
  } catch {
    /* stockage indisponible : on ignore */
  }
  window.dispatchEvent(new CustomEvent(DEMANDES_SEEN_EVENT));
}

export function onDemandesSeen(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DEMANDES_SEEN_EVENT, cb);
  return () => window.removeEventListener(DEMANDES_SEEN_EVENT, cb);
}
