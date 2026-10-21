/** Référentiels de « Mon matériel » (partagés avec le filtre du catalogue). */
export const VEHICULE_TYPES: Array<{ key: string; label: string; icon: string }> = [
  { key: "plateau", label: "Camion plateau", icon: "ramp" },
  { key: "plateau_rem", label: "Plateau remorque", icon: "ramp" },
  { key: "porteur_35", label: "Porte-voitures 3,5 t", icon: "truck" },
  { key: "porteur_35p", label: "Porte-voitures +3,5 t", icon: "truck" },
  { key: "wg", label: "Plaque W Garage", icon: "plateW" },
];

/** Types pouvant embarquer plusieurs véhicules (1 à 8). Le 3,5 t ne porte qu'une voiture (PTAC 2 t). */
export const MULTI_CAPACITE = ["plateau_rem", "porteur_35p"];
export const CAPACITE_MAX = 8;

export const OUTILS: Array<{ key: string; label: string; icon: string }> = [
  { key: "booster", label: "Booster de démarrage", icon: "bolt" },
  { key: "compresseur", label: "Compresseur pour pneumatiques", icon: "spark" },
  { key: "roulettes", label: "Roulettes porte-roues", icon: "car" },
  { key: "treuil", label: "Treuil pour plateau", icon: "link2" },
  { key: "barre", label: "Barre de redressement des roues", icon: "wrench" },
  { key: "sangles", label: "Sangles d'arrimage", icon: "link2" },
  { key: "rampes", label: "Rampes de chargement", icon: "ramp" },
  { key: "trott", label: "Trottinette électrique", icon: "bolt" },
];

export const PERMIS: Record<string, { label: string; sub: string }> = {
  AM: { label: "AM", sub: "Cyclo, 50 cm³" },
  A1: { label: "A1", sub: "Moto 125 cm³" },
  A2: { label: "A2", sub: "Moto 35 kW" },
  A: { label: "A", sub: "Toutes motos" },
  B: { label: "B", sub: "Voiture, utilitaire" },
  BE: { label: "BE", sub: "B + remorque" },
  C1: { label: "C1", sub: "3,5 à 7,5 t" },
  C1E: { label: "C1E", sub: "C1 + remorque" },
  C: { label: "C", sub: "Poids lourd" },
  CE: { label: "CE", sub: "C + remorque" },
  D1: { label: "D1", sub: "Minibus" },
  D: { label: "D", sub: "Autocar, bus" },
  DE: { label: "DE", sub: "D + remorque" },
};

export const PERMIS_GROUPES: Array<[string, string[]]> = [
  ["Deux-roues", ["AM", "A1", "A2", "A"]],
  ["Voiture et remorque légère", ["B", "BE"]],
  ["Poids lourds", ["C1", "C1E", "C", "CE"]],
  ["Transport de personnes", ["D1", "D", "DE"]],
];

/** Équipements exigés par une mission du catalogue. */
export type EquipementRequis = "plateau" | "wg" | "elec";
