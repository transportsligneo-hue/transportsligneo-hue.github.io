// Lecture centralisée de la configuration Supabase (projet transportsligneo-prod).
// Noms de variables attendus :
//   Navigateur + serveur : VITE_SB_URL, VITE_SB_PUBLISHABLE_KEY
//   Serveur uniquement   : SB_SERVER_URL (optionnel), SB_SERVICE_ROLE_KEY (secrète)
// Aucune valeur par défaut codée en dur : si une variable manque, une erreur claire est levée.

const serverEnv = (): Record<string, string | undefined> =>
  typeof process !== "undefined" && process.env ? process.env : {};

/** Adresse du projet Supabase (navigateur et serveur). */
export function sbUrl(): string | undefined {
  return (import.meta.env.VITE_SB_URL as string | undefined) || serverEnv()["SB_SERVER_URL"] || undefined;
}

/** Clé publique (publishable / anon). */
export function sbPublishableKey(): string | undefined {
  return (import.meta.env.VITE_SB_PUBLISHABLE_KEY as string | undefined) || serverEnv()["SB_PUBLISHABLE_KEY"] || undefined;
}

/** Adresse du projet côté serveur. */
export function sbServerUrl(): string | undefined {
  return serverEnv()["SB_SERVER_URL"] || (import.meta.env.VITE_SB_URL as string | undefined) || undefined;
}

/** Clé secrète service_role (serveur uniquement, jamais dans le navigateur). */
export function sbServiceRoleKey(): string | undefined {
  return serverEnv()["SB_SERVICE_ROLE_KEY"] || undefined;
}
