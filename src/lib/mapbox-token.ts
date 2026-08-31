/**
 * Clé publique Mapbox (pk.*) — jamais écrite en dur.
 * Source principale : connecteur Mapbox Lovable (VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN).
 * Repli : VITE_MAPBOX_TOKEN si défini dans l'environnement du projet.
 */
export const MAPBOX_TOKEN: string =
  ((import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined) ??
    (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ??
    "").trim();

export const hasMapbox = MAPBOX_TOKEN.startsWith("pk.");
