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
}
