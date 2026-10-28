// Grille kilométrique Ligneo (particuliers).
//  - moins de 100 km : 1,66 €/km
//  - 100 à 199 km    : 1,27 €/km (jamais moins que 165 €, prix de 99 km, pour rester croissant)
//  - 200 à 499 km    : 1,03 €/km
//  - 500 à 999 km    : dégressif et continu, de 1,03 €/km (500 km) à 0,85 €/km (1 000 km)
//  - 1 000 km et plus : 0,85 €/km
// Régime tarifaire : « micro » (auto-entrepreneur, franchise de TVA : grille ci-dessus) ou
// « societe » (assujettie à la TVA : grille 5 % sous le concurrent). Le choix se fait dans l'admin
// (réglage de facturation). Les prix des grilles sont des prix TTC client ; en société,
// HT = TTC / 1,20 (calcul déjà fait par les devis et factures).
export type TarifRegime = "micro" | "societe";
let regime: TarifRegime = "micro";
const listeners = new Set<() => void>();
export function setTarifRegime(r: TarifRegime) {
  if (r === regime) return;
  regime = r;
  listeners.forEach((l) => l());
}
export function getTarifRegime(): TarifRegime { return regime; }
export function subscribeTarifRegime(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

const TVA = 1.2;
/** En société on se place 5 % sous le concurrent (relevés du 28/10/2026, départ Tours, prix TTC). */
const SOUS_CONCURRENT = 0.95;
/** Tarif HT/km du concurrent selon la distance : 0,925 à 200 km, 0,90 de 250 à 560 km, 0,80 dès 700 km. */
function concurrentHtParKm(d: number): number {
  if (d <= 200) return 0.925;
  if (d < 250) return 0.925 - ((d - 200) / 50) * 0.025;
  if (d <= 560) return 0.9;
  if (d < 700) return 0.9 - ((d - 560) / 140) * 0.1;
  return 0.8;
}

export function kmRate(d: number): number {
  return d < 100 ? 1.66 : d < 200 ? 1.27 : d < 500 ? 1.03 : d < 1000 ? 1.03 - 0.18 * ((d - 500) / 500) : 0.85;
}
function microPrice(d: number): number {
  const p = Math.round(d * kmRate(d));
  return d >= 100 && d < 200 ? Math.max(p, 165) : p;
}
/** Prix TTC client en régime société : 5 % sous le concurrent dès 200 km (en dessous : grille habituelle). */
function societePrice(d: number): number {
  if (d < 200) return microPrice(d);
  return Math.round(d * concurrentHtParKm(d) * TVA * SOUS_CONCURRENT);
}
/** Plus petit tarif au km affiché sur le site (TTC) : 0,80 € HT × 1,20 × 0,95. */
export function kmRateMini(): number {
  return regime === "societe" ? 0.8 * TVA * SOUS_CONCURRENT : 0.85;
}
export function kmBasePrice(d: number): number {
  return regime === "societe" ? societePrice(d) : microPrice(d);
}
export function kmRateLabel(d: number): string {
  const r = regime === "societe" && d >= 200 ? kmBasePrice(d) / d : kmRate(d);
  return r.toFixed(2).replace(".", ",") + " €/km";
}
