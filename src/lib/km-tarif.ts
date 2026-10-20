// Grille kilométrique Ligneo (particuliers).
//  - moins de 100 km : 1,66 €/km
//  - 100 à 199 km    : 1,27 €/km (jamais moins que 165 €, prix de 99 km, pour rester croissant)
//  - 200 km et plus  : 0,98 €/km
export function kmRate(d: number): number {
  return d < 100 ? 1.66 : d < 200 ? 1.27 : 0.98;
}
export function kmRateLabel(d: number): string {
  return kmRate(d).toFixed(2).replace(".", ",") + " €/km";
}
export function kmBasePrice(d: number): number {
  const p = Math.round(d * kmRate(d));
  return d >= 100 && d < 200 ? Math.max(p, 165) : p;
}
