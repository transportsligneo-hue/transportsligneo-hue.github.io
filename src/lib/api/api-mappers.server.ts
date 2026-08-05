/**
 * Conversion des enregistrements internes vers les objets publics de l'API v1.
 * Server-only.
 */

export type ApiMissionStatus =
  | "pending" | "assigned" | "in_transit" | "delivered" | "cancelled";

export function toApiStatus(statut: string | null | undefined): ApiMissionStatus {
  switch ((statut ?? "").toLowerCase()) {
    case "attribue":
    case "accepte":
    case "propose":
      return "assigned";
    case "en_cours":
      return "in_transit";
    case "termine":
    case "validee":
    case "livree":
    case "en_attente_validation":
      return "delivered";
    case "annule":
    case "annulee":
      return "cancelled";
    default:
      return "pending";
  }
}

export interface MissionRow {
  id: string;
  numero: string | null;
  statut: string | null;
  ville_depart: string | null;
  ville_arrivee: string | null;
  immatriculation: string | null;
  marque: string | null;
  modele: string | null;
  prix_total: number | null;
  date_prise_en_charge: string | null;
  devis_id: string | null;
  created_at: string;
  options?: unknown;
}

export function missionToApi(m: MissionRow) {
  const options = (m.options ?? {}) as Record<string, unknown>;
  const ht = m.prix_total ?? 0;
  return {
    id: m.id,
    object: "mission",
    livemode: true,
    reference: m.numero,
    status: toApiStatus(m.statut),
    pickup_address: m.ville_depart,
    delivery_address: m.ville_arrivee,
    vehicle_plate: m.immatriculation,
    vehicle: { brand: m.marque, model: m.modele },
    pickup_date: m.date_prise_en_charge,
    quote_id: m.devis_id,
    po_number: (options["po_number"] as string | undefined) ?? null,
    price_ht: Number((ht / 1.2).toFixed(2)),
    price_ttc: Number(ht.toFixed(2)),
    currency: "EUR",
    created_at: m.created_at,
  };
}

export interface QuoteRow {
  id: string;
  numero: string | null;
  statut: string | null;
  depart: string;
  arrivee: string;
  distance_km: number | null;
  total_ht: number | null;
  total_ttc: number | null;
  prix_estime: number | null;
  expires_at: string | null;
  date_souhaitee: string | null;
  created_at: string;
}

export function quoteToApi(q: QuoteRow) {
  const ttc = q.total_ttc ?? q.prix_estime ?? 0;
  const ht = q.total_ht ?? Number((ttc / 1.2).toFixed(2));
  return {
    id: q.id,
    object: "quote",
    livemode: true,
    reference: q.numero,
    status: q.statut,
    pickup_address: q.depart,
    delivery_address: q.arrivee,
    pickup_date: q.date_souhaitee,
    distance_km: q.distance_km,
    price_ht: Number(ht.toFixed(2)),
    price_ttc: Number(ttc.toFixed(2)),
    currency: "EUR",
    valid_until: q.expires_at,
    created_at: q.created_at,
  };
}

/** Mappe les types de véhicule de l'API vers la grille tarifaire interne. */
export function toInternalVehicleType(v: string | undefined): "leger" | "utilitaire" | "premium" | "electrique" {
  switch ((v ?? "").toLowerCase()) {
    case "utilitaire":
      return "utilitaire";
    case "luxe":
    case "suv":
      return "premium";
    case "electrique":
      return "electrique";
    default:
      return "leger";
  }
}
