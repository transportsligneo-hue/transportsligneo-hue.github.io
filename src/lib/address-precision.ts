/**
 * Adresse « précise » : on refuse une simple ville (« Tours », « Paris (75015) », « 37000 Tours »).
 * Le calcul du tarif (distance, forfaits locaux, tarifs clients spéciaux) reste identique :
 * on n'ajoute qu'une exigence de saisie, la chaîne d'adresse n'est jamais modifiée.
 */
export const ADDRESS_PRECISION_MESSAGE =
  "Merci d'indiquer une adresse précise (numéro et rue, ou lieu-dit / site), pas seulement une ville. Choisissez une adresse proposée dans la liste.";

const VOIE =
  /(^|[\s,'’-])(rue|r\.|avenue|av\.?|boulevard|bd|bvd|chemin|ch\.|route|rte|impasse|all[ée]e|place|quai|cours|passage|square|esplanade|rond[- ]?point|zone|zi|za|zac|parc|lotissement|lieu[- ]?dit|r[ée]sidence|hameau|voie|promenade|mail|rempart|faubourg|cit[ée]|domaine|ferme|parking|gare|a[ée]roport|concession|garage|port|plateforme|d[ée]p[ôo]t|agence|usine|entrep[ôo]t|b[âa]timent|stra(?:ss|ß)e|via|calle|carrer|avenida|plaza|piazza|weg|laan|straat|rua|autoroute|centre commercial|zone industrielle|zone artisanale)(?=$|[\s,.'’-])/i;

export function isPreciseAddress(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (v.length < 6) return false;
  // Mot de voie / site (rue, avenue, ZAC, gare, parking, concession…)
  if (VOIE.test(v)) return true;
  // Numéro de voie (1 à 4 chiffres, hors code postal) suivi d'un mot : « 12 bis Jaurès »
  if (/(^|[\s,])\d{1,4}\s*(bis|ter|quater)?\s*,?\s+[A-Za-zÀ-ÿ]{3,}/i.test(v.replace(/\b\d{5}\b/g, ""))) return true;
  // Lieu-dit : du texte AVANT le code postal, puis une ville (« Galmoisin 86160 Saint-Maurice »)
  const m = v.match(/^(.*?[A-Za-zÀ-ÿ].*?)[\s,]+\b\d{5}\b[\s,]+([A-Za-zÀ-ÿ].*)$/);
  if (m) {
    const avant = m[1].replace(/[(),]/g, " ").trim().toLowerCase();
    const apres = m[2].replace(/,.*$/, "").trim().toLowerCase();
    if (avant && avant !== apres && !apres.startsWith(avant) && !avant.startsWith(apres)) return true;
  }
  return false;
}
