// Grille kilométrique Ligneo (particuliers).
//  - moins de 100 km : 1,66 €/km
//  - 100 à 199 km    : 1,27 €/km (jamais moins que 165 €, prix de 99 km, pour rester croissant)
//  - 200 à 499 km    : 1,03 €/km
//  - 500 à 999 km    : dégressif et continu, de 1,03 €/km (500 km) à 0,85 €/km (1 000 km)
//  - 1 000 km et plus : 0,85 €/km
export function kmRate(d: number): number {
  return d < 100 ? 1.66 : d < 200 ? 1.27 : d < 500 ? 1.03 : d < 1000 ? 1.03 - 0.18 * ((d - 500) / 500) : 0.85;
}
export function kmRateLabel(d: number): string {
  return kmRate(d).toFixed(2).replace(".", ",") + " €/km";
}
export function kmBasePrice(d: number): number {
  const p = Math.round(d * kmRate(d));
  return d >= 100 && d < 200 ? Math.max(p, 165) : p;
}
