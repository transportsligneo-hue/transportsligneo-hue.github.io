import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

/** Charte documentaire officielle Transports Ligneo — utilisée par TOUS les PDF. */
export const DOC_NAVY: [number, number, number] = [11, 16, 38];
export const DOC_NAVY_SOFT: [number, number, number] = [17, 26, 61];
export const DOC_GOLD: [number, number, number] = [212, 175, 55];
export const DOC_GOLD_SOFT: [number, number, number] = [231, 199, 106];
export const DOC_TEXT: [number, number, number] = [40, 40, 50];
export const DOC_MUTED: [number, number, number] = [110, 110, 120];
export const DOC_LINE: [number, number, number] = [225, 220, 200];
export const DOC_WHITE: [number, number, number] = [255, 255, 255];
export const DOC_CREAM: [number, number, number] = [250, 247, 239];

export interface CompanyInfo {
  raison_sociale: string | null;
  forme_juridique: string | null;
  capital_social: string | null;
  rcs: string | null;
  siret: string | null;
  tva_intra: string | null;
  adresse_ligne1: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
  adresse_pays: string | null;
  email_contact: string | null;
  telephone: string | null;
  site_web: string | null;
  signataire_nom: string | null;
  signataire_fonction: string | null;
  assurance_mention: string | null;
  iban?: string | null;
  bic?: string | null;
  banque_nom?: string | null;
}

export const COMPANY_REQUIRED_FIELDS: (keyof CompanyInfo)[] = [
  "raison_sociale",
  "forme_juridique",
  "capital_social",
  "rcs",
  "siret",
  "tva_intra",
  "adresse_ligne1",
  "adresse_cp",
  "adresse_ville",
  "email_contact",
  "telephone",
];

export function isCompanyComplete(c?: CompanyInfo | null): boolean {
  if (!c) return false;
  return COMPANY_REQUIRED_FIELDS.every((k) => {
    const v = c[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

/** Informations légales publiques (sans coordonnées bancaires). */
export async function fetchCompanyInfo(): Promise<CompanyInfo | null> {
  const { data, error } = await supabase.rpc("get_company_public_info");
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as CompanyInfo;
}

/** Informations complètes (admin uniquement — inclut IBAN/BIC). */
export async function fetchCompanyInfoFull(): Promise<CompanyInfo | null> {
  const { data, error } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
  if (error || !data) return null;
  return data as unknown as CompanyInfo;
}

export function companyAddressLine(c?: CompanyInfo | null): string {
  if (!c) return "";
  return [c.adresse_ligne1, [c.adresse_cp, c.adresse_ville].filter(Boolean).join(" "), c.adresse_pays]
    .filter((s) => s && String(s).trim())
    .join(", ");
}

/** Ligne 1 du pied de page légal : forme, capital, RCS, SIRET, TVA. */
export function companyLegalLine1(c?: CompanyInfo | null): string {
  if (!c) return "";
  const parts: string[] = [];
  if (c.forme_juridique || c.capital_social) {
    parts.push([c.forme_juridique, c.capital_social ? `au capital de ${c.capital_social}` : null].filter(Boolean).join(" "));
  }
  if (c.rcs) parts.push(`RCS ${c.rcs}`);
  if (c.siret) parts.push(`SIRET ${c.siret}`);
  if (c.tva_intra) parts.push(`TVA ${c.tva_intra}`);
  return parts.join(" — ");
}

/** Ligne 2 du pied de page légal : adresse et contacts. */
export function companyLegalLine2(c?: CompanyInfo | null): string {
  if (!c) return "";
  return [companyAddressLine(c), c.email_contact, c.telephone, c.site_web]
    .filter((s) => s && String(s).trim())
    .join(" — ");
}

export async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Bandeau navy + liseré or, identique sur tous les documents officiels. */
export function drawDocHeader(
  doc: jsPDF,
  opts: {
    pageW: number;
    logoData?: string | null;
    title: string;
    subtitle?: string;
    numero?: string;
    company?: CompanyInfo | null;
    height?: number;
  },
) {
  const { pageW, logoData, title, subtitle, numero, company } = opts;
  const h = opts.height ?? 46;
  doc.setFillColor(...DOC_NAVY);
  doc.rect(0, 0, pageW, h, "F");
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", 12, (h - 30) / 2, 30, 30);
    } catch {
      /* logo optionnel */
    }
  }
  doc.setTextColor(...DOC_WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text((company?.raison_sociale || "TRANSPORTS LIGNEO").toUpperCase(), 47, h / 2 - 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...DOC_GOLD_SOFT);
  doc.text("CONVOYAGE AUTOMOBILE PREMIUM — FRANCE & EUROPE", 47, h / 2 + 4);

  doc.setTextColor(...DOC_WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title.toUpperCase(), pageW - 14, h / 2 - 2, { align: "right" });
  if (numero) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOC_GOLD);
    doc.text(numero, pageW - 14, h / 2 + 5, { align: "right" });
  }
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOC_GOLD_SOFT);
    doc.text(subtitle, pageW - 14, h / 2 + 11, { align: "right" });
  }

  doc.setDrawColor(...DOC_GOLD);
  doc.setLineWidth(0.8);
  doc.line(0, h, pageW, h);
}

/** Pied de page légal dynamique (aucune mention codée en dur). */
export function drawDocLegalFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  company?: CompanyInfo | null,
) {
  const top = pageH - 20;
  doc.setDrawColor(...DOC_GOLD);
  doc.setLineWidth(0.4);
  doc.line(14, top, pageW - 14, top);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...DOC_NAVY);
  doc.text((company?.raison_sociale || "TRANSPORTS LIGNEO").toUpperCase(), pageW / 2, top + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...DOC_MUTED);
  const l1 = companyLegalLine1(company);
  const l2 = companyLegalLine2(company);
  if (l1) doc.text(l1, pageW / 2, top + 9.5, { align: "center" });
  if (l2) doc.text(l2, pageW / 2, top + 13.5, { align: "center" });
}

/** Titre de section navy pleine largeur. */
export function drawSectionTitle(doc: jsPDF, pageW: number, y: number, label: string): number {
  doc.setFillColor(...DOC_NAVY);
  doc.rect(14, y, pageW - 28, 7.5, "F");
  doc.setTextColor(...DOC_WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(label.toUpperCase(), 18, y + 5.2);
  return y + 12;
}

/** Ligne "label / valeur" en tableau clair (modèles passage à vide / fiche mission). */
export function drawKeyValueRow(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  opts?: { labelW?: number; height?: number },
): number {
  const h = opts?.height ?? 8.5;
  const labelW = opts?.labelW ?? 55;
  doc.setFillColor(...DOC_CREAM);
  doc.rect(x, y, w, h, "F");
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_NAVY);
  doc.text(label, x + 3, y + h / 2 + 1.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DOC_TEXT);
  const lines = doc.splitTextToSize(value || "—", w - labelW - 6);
  doc.text(lines.slice(0, 1), x + labelW, y + h / 2 + 1.2);
  return y + h + 1.5;
}

export const eurFmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);

export const dateFmt = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return d;
  }
};
