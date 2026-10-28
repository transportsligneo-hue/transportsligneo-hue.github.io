// Grille kilométrique Ligneo (particuliers).
//  - moins de 100 km : 1,66 €/km
//  - 100 à 199 km    : 1,27 €/km (jamais moins que 165 €, prix de 99 km, pour rester croissant)
//  - 200 à 499 km    : 1,03 €/km
//  - 500 à 999 km    : dégressif et continu, de 1,03 €/km (500 km) à 0,85 €/km (1 000 km)
//  - 1 000 km et plus : 0,85 €/km
// Régime tarifaire : « micro » (auto-entrepreneur, franchise de TVA : grille ci-dessus) ou
// « societe » (assujettie à la TVA : grille alignée sur le marché). Le choix se fait dans l'admin
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

/** Société : de 700 km à plus, 0,78 € HT/km (concurrent à 0,80 €), soit 0,936 € TTC/km. */
const SOCIETE_HT_PAR_KM = 0.78;
const TVA = 1.2;
const SOCIETE_DEBUT = 700;

export function kmRate(d: number): number {
  return d < 100 ? 1.66 : d < 200 ? 1.27 : d < 500 ? 1.03 : d < 1000 ? 1.03 - 0.18 * ((d - 500) / 500) : 0.85;
}
function microPrice(d: number): number {
  const p = Math.round(d * kmRate(d));
  return d >= 100 && d < 200 ? Math.max(p, 165) : p;
}
/** Prix TTC client en régime société (grille alignée marché à partir de 700 km, raccord progressif dès 500 km). */
function societePrice(d: number): number {
  if (d < 500) return microPrice(d);
  const fin = Math.round(SOCIETE_DEBUT * SOCIETE_HT_PAR_KM * TVA);
  if (d >= SOCIETE_DEBUT) return Math.round(d * SOCIETE_HT_PAR_KM * TVA);
  const debut = microPrice(500);
  return Math.round(debut + ((fin - debut) * (d - 500)) / (SOCIETE_DEBUT - 500));
}
export function kmBasePrice(d: number): number {
  return regime === "societe" ? societePrice(d) : microPrice(d);
}
export function kmRateLabel(d: number): string {
  const r = regime === "societe" && d >= 500 && d > 0 ? kmBasePrice(d) / d : kmRate(d);
  return r.toFixed(2).replace(".", ",") + " €/km";
}
