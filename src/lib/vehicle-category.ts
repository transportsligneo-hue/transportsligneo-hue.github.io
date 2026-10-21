/** Catégorie d'affichage (pastille du catalogue) déduite de la marque et du modèle. */
export type VehicleCategory = "Citadine" | "Berline" | "SUV" | "Utilitaire" | "Fourgon";

const FOURGON = /\b(master|trafic|transit|sprinter|crafter|boxer|ducato|movano|jumper|daily|vivaro|vito|talento|expert|jumpy|dispatch|proace|trafic)\b/i;
const UTILITAIRE = /\b(kangoo|partner|berlingo|caddy|combo|doblo|connect|rifter|express|townstar|nemo|bipper|fiorino|kubistar|citan|e-?partner|e-?berlingo|e-?expert|e-?jumpy)\b/i;
const SUV = /\b(model\s?[xy]|tiguan|t-?roc|t-?cross|touareg|3008|5008|2008|c5\s?aircross|c3\s?aircross|c4\s?x|captur|kadjar|arkana|austral|duster|sandero\s?stepway|qashqai|juke|x-?trail|kuga|puma|ecosport|tucson|kona|sportage|niro|ceed\s?x|rav4|c-?hr|yaris\s?cross|x[1-7]\b|q[2-8]\b|glc|gla|glb|gle|cx-?[35]|mokka|grandland|crossland|ateca|karoq|kodiaq|formentor|ioniq\s?5|id\.?\s?[4-5]|enyaq|bz4x|mustang\s?mach|zs|hs|eqa|eqb|eqc|defender|discovery|evoque|range\s?rover|macan|cayenne|urus|levante|stelvio|tonale|500x|avenger|compass|renegade|wrangler|cherokee|4008|e-?2008|e-?3008)\b/i;
const BERLINE = /\b(model\s?[3s]|c4\b|c5\b|308|508|408|megane|mégane|talisman|laguna|passat|golf|arteon|jetta|id\.?\s?[37]|a[3-8]\b|s[3-8]\b|serie\s?[1-8]|série\s?[1-8]|classe\s?[a-e]|focus|mondeo|insignia|astra|octavia|superb|leon|ceed|i30|elantra|civic|accord|corolla|prius|mazda\s?[36]|giulia|giulietta|a-?class|c-?class|e-?class|i4|ioniq\s?6|taycan|panamera|ev6|kia\s?ev6|mégane\s?e-?tech|zoe\s?z\.?e\.?)\b/i;

export function vehicleCategory(marque?: string | null, modele?: string | null): VehicleCategory {
  const s = `${marque ?? ""} ${modele ?? ""}`.toLowerCase();
  if (FOURGON.test(s)) return "Fourgon";
  if (UTILITAIRE.test(s)) return "Utilitaire";
  if (SUV.test(s)) return "SUV";
  if (BERLINE.test(s)) return "Berline";
  return "Citadine";
}
