export type UnifiedStatus = "nouvelle" | "attribuer" | "attribuee" | "encours" | "terminee" | "annulee";

export const UNIFIED_STATUS: Record<UnifiedStatus, { label: string; cls: string }> = {
  nouvelle: { label: "Nouvelle", cls: "new" },
  attribuer: { label: "À attribuer", cls: "attribuer" },
  attribuee: { label: "Attribuée", cls: "attribuee" },
  encours: { label: "En cours", cls: "encours" },
  terminee: { label: "Terminée", cls: "terminee" },
  annulee: { label: "Annulée", cls: "annulee" },
};

export const UNIFIED_ORDER: UnifiedStatus[] = ["nouvelle", "attribuer", "attribuee", "encours", "terminee", "annulee"];

/** Mappe le statut d'un trajet (pipeline existant) vers le statut fusionné. */
export function trajetToUnified(statut: string): UnifiedStatus {
  switch (statut) {
    case "en_attente": return "attribuer";
    case "attribue":
    case "accepte": return "attribuee";
    case "en_cours": return "encours";
    case "termine": return "terminee";
    case "annule": return "annulee";
    default: return "attribuer";
  }
}

export interface UnifiedMission {
  kind: "demande" | "trajet";
  id: string;
  ref: string;
  status: UnifiedStatus;
  depart: string;
  arrivee: string;
  date: string | null;
  heure: string | null;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  clientNom: string | null;
  clientEmail: string | null;
  clientTel: string | null;
  prix: number | null;
  prixConvoyeur: number | null;
  prixSuggere: number | null;
  statutPublication: string | null;
  isRoundTrip: boolean;
  legType: string | null;
  groupId?: string | null;
  legIndex?: number | null;
  isTest: boolean;
  createdAt: string;
  pricingMode?: "fixe" | "enchere" | null;
  prixClientTtc?: number | null;
  prixConvoyeurFixe?: number | null;
  prixConvoyeurMin?: number | null;
  prixConvoyeurMax?: number | null;
  margeIndicativePct?: number | null;
  rechargeSeule?: boolean;
  /** Lot multi-plaques (une mission, plusieurs véhicules) */
  lotId?: string | null;
  lotRef?: string | null;
  /** Numéro de commande / PO client */
  commandeRef?: string | null;
  /** Mission archivée (terminée/annulée depuis plus de 60 jours) */
  archived?: boolean;
}

/** Statuts considérés comme "activité en cours ou à venir". */
export const ACTIVE_STATUSES: UnifiedStatus[] = ["nouvelle", "attribuer", "attribuee", "encours"];

/**
 * Tri par défaut : missions actives d'abord (date la plus proche en premier),
 * puis missions terminées/annulées (date la plus récente en premier).
 */
export function compareDefaultOrder(a: UnifiedMission, b: UnifiedMission): number {
  const aActive = ACTIVE_STATUSES.includes(a.status);
  const bActive = ACTIVE_STATUSES.includes(b.status);
  if (aActive !== bActive) return aActive ? -1 : 1;
  const ta = new Date(a.date ?? a.createdAt).getTime();
  const tb = new Date(b.date ?? b.createdAt).getTime();
  if (ta !== tb) return aActive ? ta - tb : tb - ta;
  if (a.groupId && a.groupId === b.groupId) return (a.legIndex ?? 1) - (b.legIndex ?? 1);
  return 0;
}

