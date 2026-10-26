/**
 * Motorisation + type de véhicule : source unique pour TOUS les écrans
 * (admin, flotte, client, convoyeur). Les champs énergie sont lus dans l'ordre :
 * trajet.vehicule_energie → mission.carburant → devis.carburant → demande.
 */
import { isElectricEnergie, guessElectricFromModel, resolveEnergie } from "@/lib/vehicule-electrique";

export type Motorisation = "electrique" | "hybride_rechargeable" | "hybride" | "thermique";

export interface MotorisationInfo {
  kind: Motorisation | null;
  /** true = déduit du modèle (pas confirmé par une donnée saisie). */
  inferred: boolean;
}

const THERMIQUE_RE = /essence|diesel|gazole|gasoil|gpl|gnv|thermique|^\s*(es|go|gp)\s*$|sp\s?95|sp\s?98|e85/i;

export function resolveMotorisation(
  energies: (string | null | undefined)[],
  marque?: string | null,
  modele?: string | null,
): MotorisationInfo {
  const e = resolveEnergie(...energies) ?? "";
  if (/hybr/i.test(e) || /phev/i.test(e) || /plug.?in/i.test(e)) {
    return { kind: /rechargeable|phev|plug/i.test(e) ? "hybride_rechargeable" : "hybride", inferred: false };
  }
  if (isElectricEnergie(e)) return { kind: "electrique", inferred: false };
  if (THERMIQUE_RE.test(e)) return { kind: "thermique", inferred: false };
  if (guessElectricFromModel(marque, modele)) return { kind: "electrique", inferred: true };
  return { kind: null, inferred: false };
}

export const MOTORISATION_LABEL: Record<Motorisation, string> = {
  electrique: "Électrique",
  hybride_rechargeable: "Hybride rechargeable",
  hybride: "Hybride",
  thermique: "Thermique",
};

const TYPE_LABELS: Record<string, string> = {
  citadine: "Citadine", berline: "Berline", break: "Break", suv: "SUV", monospace: "Monospace",
  coupe: "Coupé", cabriolet: "Cabriolet", luxe: "Luxe / Supercar", utilitaire: "Utilitaire", autre: "Autre",
};

export function vehicleTypeLabel(type?: string | null): string | null {
  const t = (type ?? "").trim();
  if (!t) return null;
  const key = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return TYPE_LABELS[key] ?? (t.length <= 24 ? t.charAt(0).toUpperCase() + t.slice(1) : t);
}

/** VIN affiché en version courte (8 derniers caractères) — un seul format partout. */
export function shortVin(vin?: string | null): string | null {
  const v = (vin ?? "").trim();
  return v ? v.slice(-8).toUpperCase() : null;
}
