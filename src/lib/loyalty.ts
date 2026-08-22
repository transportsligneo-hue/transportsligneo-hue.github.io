/**
 * Compte Kilomètres Ligneo — types et helpers partagés (client + serveur).
 * Le programme n'est PAS public : aucune mention sur les pages publiques.
 */

export interface LoyaltyTier {
  id: string;
  label: string;
  seuil_km_min: number;
  seuil_km_max: number | null;
  taux: number;
  sort_order: number;
}

export interface LoyaltyAccount {
  id: string;
  client_id: string;
  email: string | null;
  km_cumules_periode: number;
  montant_ht_cumule_periode: number;
  date_debut_periode: string;
  solde_avoir: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyReward {
  id: string;
  loyalty_account_id: string;
  date_calcul: string;
  km_au_calcul: number;
  montant_ht_periode: number;
  taux_applique: number;
  montant_avoir_genere: number;
  montant_utilise: number;
  date_expiration_avoir: string | null;
  statut: "actif" | "partiel" | "utilise" | "expire";
  source: string;
  note: string | null;
}

export const DEFAULT_TIERS: LoyaltyTier[] = [
  { id: "t1", label: "0 à 4 000 km", seuil_km_min: 0, seuil_km_max: 4000, taux: 1, sort_order: 1 },
  { id: "t2", label: "4 001 à 10 000 km", seuil_km_min: 4001, seuil_km_max: 10000, taux: 2, sort_order: 2 },
  { id: "t3", label: "10 001 à 20 000 km", seuil_km_min: 10001, seuil_km_max: 20000, taux: 3, sort_order: 3 },
  { id: "t4", label: "Au-delà de 20 000 km", seuil_km_min: 20001, seuil_km_max: null, taux: 4, sort_order: 4 },
];

export function currentTier(km: number, tiers: LoyaltyTier[] = DEFAULT_TIERS): LoyaltyTier {
  const sorted = [...tiers].sort((a, b) => a.seuil_km_min - b.seuil_km_min);
  let found = sorted[0]!;
  for (const t of sorted) {
    if (km >= t.seuil_km_min && (t.seuil_km_max == null || km <= t.seuil_km_max)) found = t;
  }
  return found;
}

export function nextTier(km: number, tiers: LoyaltyTier[] = DEFAULT_TIERS): LoyaltyTier | null {
  const sorted = [...tiers].sort((a, b) => a.seuil_km_min - b.seuil_km_min);
  return sorted.find((t) => t.seuil_km_min > km) ?? null;
}

/** Fin de la période de référence (12 mois glissants). */
export function periodEnd(dateDebut: string): Date {
  const d = new Date(dateDebut);
  d.setMonth(d.getMonth() + 12);
  return d;
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

export function formatKm(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value || 0)} km`;
}

export function formatDateFr(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
