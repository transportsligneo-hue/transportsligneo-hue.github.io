/** Services de jockeyage proposés dans les demandes de convoyage (simple et groupée). */
export const JOKEAGE_SERVICES = [
  { key: "controle_technique", label: "Contrôle technique" },
  { key: "contre_visite", label: "Contre-visite du contrôle technique" },
  { key: "revision", label: "Révision / entretien constructeur" },
  { key: "vidange", label: "Vidange et filtres" },
  { key: "pneumatiques", label: "Pneumatiques (changement, permutation, saisonnier)" },
  { key: "freinage", label: "Freinage" },
  { key: "climatisation", label: "Recharge de climatisation" },
  { key: "carrosserie", label: "Carrosserie / débosselage" },
  { key: "pare_brise", label: "Pare-brise et vitrage" },
  { key: "diagnostic", label: "Diagnostic électronique" },
  { key: "rappel_constructeur", label: "Rappel constructeur / garantie" },
  { key: "batterie", label: "Batterie" },
  { key: "lavage", label: "Lavage / préparation esthétique" },
  { key: "garage", label: "Dépôt ou récupération au garage" },
] as const;

export type JokeageService = (typeof JOKEAGE_SERVICES)[number]["key"];

export const JOKEAGE_LABELS: Record<string, string> = Object.fromEntries(
  JOKEAGE_SERVICES.map((s) => [s.key, s.label]),
);
