// Tarifs locaux par département (10 grandes métropoles)
// Règle :
//   - même département + distance ≤ 30 km  →  forfait agglomération
//   - même département + distance > 30 km  →  forfait hors agglomération
// Les tarifs FIXED_TARIFFS existants gardent leur priorité dans calculatePrice.

export const DEPT_MAIN_CITIES: Record<string, string> = {
  "37": "Tours",
  "69": "Lyon",
  "13": "Marseille",
  "33": "Bordeaux",
  "31": "Toulouse",
  "44": "Nantes",
  "75": "Paris",
  "59": "Lille",
  "67": "Strasbourg",
  "06": "Nice",
};

/** Extrait le code département (2 chiffres) depuis un code postal présent dans l'adresse. */
export function extractDeptCode(address: string): string | null {
  if (!address) return null;
  const m = address.match(/\b(\d{5})\b/);
  if (!m) return null;
  const cp = m[1];
  // Corse (20xxx → 2A/2B) : non gérée en v1, on retourne null
  if (cp.startsWith("20")) return null;
  return cp.slice(0, 2);
}

export interface LocalTariff {
  price: number;
  label: string;
  finalPrice: number;
  multiplierLabel: string;
  hasExtra: boolean;
}

/**
 * Renvoie le forfait local si départ et arrivée sont dans le même département parmi
 * les 10 métropoles couvertes. Sinon `null`.
 */
export function resolveLocalDeptTariff(
  departure: string,
  arrival: string,
  distanceKm: number,
  option: string,
): LocalTariff | null {
  const dDep = extractDeptCode(departure);
  const dArr = extractDeptCode(arrival);
  if (!dDep || !dArr || dDep !== dArr) return null;
  const mainCity = DEPT_MAIN_CITIES[dDep];
  if (!mainCity) return null;

  const intra = distanceKm <= 30;
  const simple = intra ? 79 : 99;
  const retour = 129;
  const label = intra
    ? `Forfait ${mainCity} (agglomération)`
    : `Forfait département ${dDep} — hors agglomération`;

  if (option === "aller-retour") {
    return { price: simple, label, finalPrice: retour, multiplierLabel: "Aller-retour", hasExtra: true };
  }
  if (option === "express") {
    return { price: simple, label, finalPrice: Math.round(simple * 1.2), multiplierLabel: "+20% express", hasExtra: true };
  }
  return { price: simple, label, finalPrice: simple, multiplierLabel: "", hasExtra: false };
}
