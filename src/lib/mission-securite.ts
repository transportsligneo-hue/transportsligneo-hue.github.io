/**
 * Règles de sécurité obligatoires du convoyeur.
 * Reprises telles quelles de la checklist de départ existante
 * (EdlStartChecklistGate / DepartureChecklistSheet) — source unique.
 */
export const REGLES_SECURITE_CONVOYEUR = [
  "Gilet jaune haute visibilité à bord et porté avant d’approcher le véhicule ou en cas d’arrêt sur la voie publique.",
  "Kit de sécurité complet dans le véhicule : triangle de signalisation + gilet.",
  "Permis de conduire original en cours de validité, en votre possession.",
  "Documents de conduite à jour : assurance du véhicule utilisé pour vous rendre sur place.",
  "Tenue correcte et professionnelle, conforme à la charte de présentation (survêtement proscrit).",
] as const;
