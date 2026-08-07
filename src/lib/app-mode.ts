/**
 * Détection du mode "app mobile" (coquille Capacitor).
 *
 * Le même site sert le web public ET l'app native : la détection est donc
 * faite au runtime (User-Agent Capacitor / global Capacitor / paramètre ?app=1
 * mémorisé), avec un flag de build optionnel VITE_APP_MODE=mobile-app.
 */

const STORAGE_KEY = "ligneo:app-mode";

/** Routes autorisées dans l'app mobile (Connexion/Inscription + Driver + Admin). */
export const MOBILE_APP_ALLOWED_PREFIXES = [
  "/login",
  "/mot-de-passe-oublie",
  "/reset-password",
  "/auth",
  "/inscription-convoyeur",
  "/invitation-convoyeur",
  "/attente-validation",
  "/convoyeur",
  "/admin",
  "/notifications",
  "/scan",
  "/confidentialite",
  "/mentions-legales",
] as const;

export function isMobileAppRoute(pathname: string): boolean {
  return MOBILE_APP_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Vrai uniquement côté client, dans la coquille Capacitor. */
export function isMobileAppShell(): boolean {
  if (import.meta.env.VITE_APP_MODE === "mobile-app") return true;
  if (typeof window === "undefined") return false;

  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  if (w.Capacitor?.isNativePlatform?.()) return true;
  if (navigator.userAgent.includes("LigneoDriverApp")) return true;

  try {
    if (new URLSearchParams(window.location.search).get("app") === "1") {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
