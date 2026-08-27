/**
 * Extraction des champs d'un bon de commande (PO) Groupe CAT / K2.
 * Fonctions pures : testables sans réseau ni base de données.
 *
 * Deux formats reçus :
 *  A — "NOTIFICATION K2" : n° de PO dans le sujet + PJ nommée <numero>.pdf
 *  B — "Groupe CAT commande d'achat n° <10 chiffres>" : PDF structuré
 */

import { isValidVinFormat, normalizeVin } from "@/lib/vin";

export type ParsedPo = {
  numero_po: string | null;
  vin: string | null;
  montant_ht: number | null;
  date_commande: string | null;
  date_livraison: string | null;
  destinataire: string | null;
  emetteur: string | null;
};

const PO_RE = /\b45\d{8}\b/;

/** Numéro de PO (10 chiffres commençant par 45) depuis le sujet ou le nom de la PJ. */
export function extractPoNumber(...sources: (string | null | undefined)[]): string | null {
  for (const s of sources) {
    const m = s?.match(PO_RE);
    if (m) return m[0];
  }
  return null;
}

/** Normalise un texte PDF : espaces insécables, retours ligne, colonnes. */
export function normalizePdfText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Convertit "12/05/2026" ou "12-05-2026" en ISO "2026-05-12". */
export function parseFrDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y!.length === 2 ? `20${y}` : y!;
    return `${year}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  const iso = input.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

/** Montant français "1 234,56" → 1234.56 */
export function parseFrAmount(input: string | null | undefined): number | null {
  if (!input) return null;
  const cleaned = input.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Cherche un VIN plausible (17 caractères valides) dans un texte libre. */
export function findVinInText(text: string): string | null {
  const upper = text.toUpperCase();

  // 1. VIN parfaitement formé (17 caractères)
  const strict = upper.match(/\b[A-HJ-NPR-Z0-9]{17}\b/g) ?? [];
  for (const c of strict) {
    if (/[A-Z]/.test(c) && /\d/.test(c) && isValidVinFormat(c)) return c;
  }

  // 2. Ligne de désignation ("010 Recharge pour transport VF1RCB...") :
  //    l'extraction de texte des PDF CAT perd parfois un caractère.
  const designation = upper
    .split("\n")
    .find((l) => /RECHARGE|TRANSPORT|CONVOYAGE|VIN/.test(l) && /[A-HJ-NPR-Z]{2}\d/.test(l));
  const loose = (designation ?? upper).match(/\b[A-HJ-NPR-Z0-9]{14,17}\b/g) ?? [];
  for (const c of loose) {
    if (/^[A-Z]{2,}/.test(c) && /\d{4,}/.test(c)) return normalizeVin(c);
  }
  return null;
}

function afterLabel(text: string, label: RegExp, maxLen = 120): string | null {
  const m = text.match(label);
  if (!m || m.index === undefined) return null;
  const rest = text.slice(m.index + m[0].length, m.index + m[0].length + maxLen);
  const line = rest.split("\n").map((l) => l.trim()).filter(Boolean)[0];
  return line ? line.replace(/^[:\s-]+/, "").trim() || null : null;
}

/** Bloc destinataire : quelques lignes après "Destinataire". */
function extractDestinataire(text: string): string | null {
  const m = text.match(/Destinataire[^\n]*\n/i);
  if (!m || m.index === undefined) return null;
  const rest = text.slice(m.index + m[0].length);
  const lines = rest
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .filter((l) => !/^(Émetteur|Emetteur|Numéro|Date|Désignation|Qté)/i.test(l));
  const block = lines.join(", ").slice(0, 300);
  return block || null;
}

/** Dernier montant décimal d'une ligne de désignation (montant HT). */
function extractMontantHt(text: string): number | null {
  const explicit = text.match(/Montant\s*(?:total\s*)?H\.?T\.?[^\d-]{0,20}([\d\s.]+,\d{2})/i);
  if (explicit?.[1]) return parseFrAmount(explicit[1]);

  const designation = text
    .split("\n")
    .find((l) => /recharge|transport|convoyage|prestation|livraison/i.test(l) && /\d+,\d{2}/.test(l));
  if (designation) {
    const amounts = designation.match(/\d[\d\s.]*,\d{2}/g);
    if (amounts?.length) return parseFrAmount(amounts[amounts.length - 1]!);
  }
  const all = text.match(/\d[\d\s.]*,\d{2}/g);
  return all?.length ? parseFrAmount(all[all.length - 1]!) : null;
}

/**
 * Parse le texte d'un PDF de bon de commande CAT / K2.
 * @param subject sujet de l'email (fallback pour le n° de PO)
 * @param filename nom de la PJ (fallback pour le n° de PO — format A)
 */
export function parsePoDocument(
  pdfText: string,
  subject?: string | null,
  filename?: string | null,
): ParsedPo {
  const text = normalizePdfText(pdfText ?? "");

  const numeroFromDoc = afterLabel(text, /Num[ée]ro\s+de\s+commande\s*:?/i, 60);
  const numero_po =
    extractPoNumber(numeroFromDoc, subject, filename, text) ?? null;

  return {
    numero_po,
    vin: findVinInText(text),
    montant_ht: extractMontantHt(text),
    date_commande: parseFrDate(afterLabel(text, /Date\s+de\s+la\s+commande\s*:?/i, 40)),
    date_livraison: parseFrDate(afterLabel(text, /Date\s+de\s+livraison\s*:?/i, 40)),
    destinataire: extractDestinataire(text),
    emetteur: afterLabel(text, /[ÉE]metteur\s*:?/i, 80),
  };
}
