import { getGooglePlacesBrowserKey } from "@/lib/public-config.functions";

let keyPromise: Promise<string | null> | null = null;
let knownMissing = false;

/** Récupère (une seule fois) la clé navigateur Google depuis le serveur. */
export function fetchGoogleKey(): Promise<string | null> {
  if (!keyPromise) {
    keyPromise = getGooglePlacesBrowserKey()
      .then((r) => {
        const k = r?.key || null;
        if (!k) knownMissing = true;
        return k;
      })
      .catch(() => {
        keyPromise = null;
        return null;
      });
  }
  return keyPromise;
}

/** Faux uniquement quand on sait que la clé n'est pas configurée. */
export function googleKeyMaybeAvailable(): boolean {
  return !knownMissing;
}
