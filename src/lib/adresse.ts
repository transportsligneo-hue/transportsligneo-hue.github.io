/** Adresse postale française : rue + code postal + ville ⇄ une ligne. */
export type AdresseParts = { rue: string; cp: string; ville: string };

export function composeAdresse(p: Partial<AdresseParts>): string {
  const rue = (p.rue ?? "").trim();
  const ville = [(p.cp ?? "").trim(), (p.ville ?? "").trim()].filter(Boolean).join(" ");
  return [rue, ville].filter(Boolean).join(", ");
}

/** Découpe « 12 rue des Lilas, 37000 Tours » (ou « … 37000 TOURS ») en trois champs. */
export function splitAdresse(ligne: string | null | undefined): AdresseParts {
  const s = (ligne ?? "").replace(/\s+/g, " ").trim();
  if (!s) return { rue: "", cp: "", ville: "" };
  const m = /^(.*?)[,\s]+(\d{5})\s+(.+)$/.exec(s);
  if (m) return { rue: m[1].trim().replace(/[,\s]+$/, ""), cp: m[2], ville: m[3].trim() };
  return { rue: s, cp: "", ville: "" };
}

/** Valeurs à afficher : colonnes détaillées si présentes, sinon découpage de l'ancienne ligne unique. */
export function adresseDe(c: { adresse?: string | null; adresse_rue?: string | null; code_postal?: string | null; ville?: string | null }): AdresseParts {
  if (c.adresse_rue || c.code_postal) return { rue: c.adresse_rue ?? "", cp: c.code_postal ?? "", ville: c.ville ?? "" };
  const s = splitAdresse(c.adresse);
  return { rue: s.rue, cp: s.cp, ville: s.ville || (c.ville ?? "") };
}
