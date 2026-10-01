import { createServerFn } from "@tanstack/react-start";

/**
 * Clé navigateur Google Places, servie à la demande depuis les secrets
 * du projet (jamais écrite dans un fichier versionné).
 * C'est une clé « navigateur » : elle finit de toute façon dans l'URL du
 * script Google, sa protection repose sur les restrictions de domaine.
 */
export const getGooglePlacesBrowserKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["GOOGLE_PLACES_BROWSER_KEY"] ?? "";
  return { key };
});
