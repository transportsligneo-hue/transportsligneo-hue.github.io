/**
 * Libellés de type de mission, partagés par tous les espaces (client, flotte,
 * entreprise, convoyeur, admin) pour que l'affichage soit strictement identique.
 *
 * Règle métier :
 *  - "Recharge uniquement" : toutes les jambes sont des recharges sur place.
 *  - "restitution et livraison" : le dossier contient une jambe aller ET une
 *    jambe retour (aller/retour réel). Deux missions simplement groupées
 *    (deux véhicules distincts) ne sont PAS un aller-retour.
 *  - "Mission groupée · N véhicules" : plusieurs jambes sans aller/retour.
 *  - "Livraison simple" : une seule jambe.
 */
export interface MissionLegLike {
  /** "aller" | "retour" | "simple" | null */
  legType?: string | null;
  /** Recharge sur place uniquement (aucune livraison). */
  recharge?: boolean;
  /** "aller_retour" éventuel porté par la mission/trajet. */
  typeTrajet?: string | null;
}

/** Vrai aller-retour : au moins une jambe aller et une jambe retour. */
export function isAllerRetour(legs: MissionLegLike[]): boolean {
  const hasAller = legs.some((l) => l.legType === "aller");
  const hasRetour = legs.some((l) => l.legType === "retour");
  return hasAller && hasRetour;
}

/** Libellé d'un dossier (une ou plusieurs jambes). */
export function dossierTypeLabel(legs: MissionLegLike[]): string {
  if (legs.length === 0) return "Livraison simple";
  if (legs.every((l) => l.recharge)) {
    return legs.length > 1 ? `Recharge uniquement · ${legs.length} véhicules` : "Recharge uniquement";
  }
  if (isAllerRetour(legs)) return "restitution et livraison";
  if (legs.length > 1) return `Mission groupée · ${legs.length} véhicules`;
  if (legs[0]?.typeTrajet === "aller_retour") return "restitution et livraison";
  return "Livraison simple";
}

/** Libellé d'une jambe isolée. */
export function missionTypeLabel(leg: MissionLegLike): string {
  if (leg.recharge) return "Recharge uniquement";
  if (leg.legType === "aller" || leg.legType === "retour" || leg.typeTrajet === "aller_retour") {
    return "restitution et livraison";
  }
  return "Livraison simple";
}
