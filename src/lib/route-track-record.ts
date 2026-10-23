/**
 * « Trajets réussis » affichés sous le prix du devis.
 *
 * Les +5000 trajets ont été réalisés avant le site : ils ne sont donc pas dans la base de données.
 * ➜ Renseignez ici, à la main, le nombre RÉEL de trajets déjà faits sur vos axes principaux
 *   (clé = "ville de départ>ville d'arrivée", en minuscules, sans accents ; le sens inverse compte aussi).
 * Pour un axe non renseigné, le devis affiche simplement le total global.
 */
export const TOTAL_TRIPS = 5000;

export const ROUTE_HISTORY: Record<string, number> = {
  // "tours>bordeaux": 0,   ← à compléter avec vos vrais chiffres, par exemple
  // "tours>paris": 0,
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function tripsForRoute(fromCity: string, toCity: string): number {
  const a = norm(fromCity), b = norm(toCity);
  if (!a || !b) return 0;
  return (ROUTE_HISTORY[`${a}>${b}`] ?? 0) + (ROUTE_HISTORY[`${b}>${a}`] ?? 0);
}
