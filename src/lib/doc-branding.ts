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

/** Convertit un SIRET (14 chiffres) en SIREN (9 chiffres, sans le NIC). */
export function toSiren(siret?: string | null): string | null {
  if (!siret) return null;
  const digits = String(siret).replace(/\D/g, "");
  if (digits.length < 9) return null;
  const siren = digits.slice(0, 9);
  return `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6, 9)}`;
}

/** Ligne 1 du pied de page légal : forme, capital, RCS, SIREN, TVA. */
export function companyLegalLine1(c?: CompanyInfo | null): string {
  if (!c) return "";
  const parts: string[] = [];
  if (c.forme_juridique || c.capital_social) {
    parts.push([c.forme_juridique, c.capital_social ? `au capital de ${c.capital_social}` : null].filter(Boolean).join(" "));
  }
  if (c.rcs) parts.push(`RCS ${c.rcs}`);
  const siren = toSiren(c.siret);
  if (siren) parts.push(`SIREN ${siren}`);
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

/* ------------------------------------------------------------------ */
/* Pagination robuste : jamais de texte sous le pied de page légal      */
/* ------------------------------------------------------------------ */

/** Hauteur réservée en bas de page pour le pied de page légal. */
export const DOC_FOOTER_RESERVED = 26;
/** Ordonnée de départ du contenu sur une page de continuation. */
export const DOC_CONT_TOP = 30;

type DocCtx = {
  pageW: number;
  logoData?: string | null;
  title: string;
  numero?: string;
  company?: CompanyInfo | null;
};

const docContexts = new WeakMap<object, DocCtx>();

/** Ordonnée maximale utilisable par le contenu sur la page courante. */
export function docContentLimit(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight() - DOC_FOOTER_RESERVED;
}

/** En-tête compact des pages de continuation. */
function drawContinuationHeader(doc: jsPDF, ctx: DocCtx) {
  const h = 20;
  doc.setFillColor(...DOC_NAVY);
  doc.rect(0, 0, ctx.pageW, h, "F");
  if (ctx.logoData) {
    try {
      doc.addImage(ctx.logoData, "PNG", 12, 3, 14, 14);
    } catch {
      /* logo optionnel */
    }
  }
  doc.setTextColor(...DOC_WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(ctx.title.toUpperCase(), 30, h / 2 + 1);
  if (ctx.numero) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DOC_GOLD);
    doc.text(ctx.numero, ctx.pageW - 14, h / 2 + 1, { align: "right" });
  }
  doc.setDrawColor(...DOC_GOLD);
  doc.setLineWidth(0.6);
  doc.line(0, h, ctx.pageW, h);
}

/**
 * Garantit qu'il reste `needed` mm avant le pied de page.
 * Ajoute une page (avec en-tête de continuation) si nécessaire et
 * renvoie l'ordonnée à utiliser.
 */
export function docEnsureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= docContentLimit(doc)) return y;
  const ctx = docContexts.get(doc as unknown as object);
  doc.addPage();
  if (ctx) {
    drawContinuationHeader(doc, ctx);
    return DOC_CONT_TOP;
  }
  return 20;
}

/**
 * À appeler juste avant `doc.output()` : dessine le pied de page légal
 * et la pagination sur TOUTES les pages du document.
 */
export function finalizeDoc(doc: jsPDF, company?: CompanyInfo | null) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ctx = docContexts.get(doc as unknown as object);
  const c = company ?? ctx?.company ?? null;
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawDocLegalFooter(doc, pageW, pageH, c);
    if (total > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...DOC_MUTED);
      doc.text(`Page ${p}/${total}`, pageW - 14, pageH - 22, { align: "right" });
    }
  }
  doc.setPage(total);
}

/** Largeur (mm) d'un texte pour une taille de police donnée. */
function fitTextWidth(doc: jsPDF, text: string, size: number): number {
  doc.setFontSize(size);
  return doc.getTextWidth(text);
}

/** Tronque un texte (avec …) pour tenir dans une largeur maximale. */
function clampText(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
  return `${t}…`;
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
  docContexts.set(doc as unknown as object, { pageW, logoData, title, numero, company });
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

  const leftX = logoData ? 47 : 14;
  const rightX = pageW - 14;
  const gap = 8;
  const totalAvail = rightX - leftX - gap;

  const raison = (company?.raison_sociale || "TRANSPORTS LIGNEO").toUpperCase();
  const tagline = "CONVOYAGE AUTOMOBILE — FRANCE & EUROPE";
  const titleTxt = title.toUpperCase();

  // Colonnes strictes : le bloc identité et le bloc titre ne se croisent jamais.
  const leftW = totalAvail * 0.42;
  const rightW = totalAvail - leftW;

  // --- Bloc identité (gauche)
  let nameSize = 14;
  doc.setFont("helvetica", "bold");
  while (nameSize > 8 && fitTextWidth(doc, raison, nameSize) > leftW) nameSize -= 0.5;
  doc.setTextColor(...DOC_WHITE);
  doc.setFontSize(nameSize);
  doc.text(clampText(doc, raison, leftW), leftX, h / 2 - 1.5);

  let tagSize = 7;
  doc.setFont("helvetica", "normal");
  while (tagSize > 4.8 && fitTextWidth(doc, tagline, tagSize) > leftW) tagSize -= 0.25;
  doc.setFontSize(tagSize);
  doc.setTextColor(...DOC_GOLD_SOFT);
  doc.text(clampText(doc, tagline, leftW), leftX, h / 2 + 4.5);

  // --- Bloc titre (droite), sur 1 ou 2 lignes selon la longueur
  let titleSize = 16;
  doc.setFont("helvetica", "bold");
  let titleLines: string[] = [titleTxt];
  while (titleSize > 10 && fitTextWidth(doc, titleTxt, titleSize) > rightW) titleSize -= 0.5;
  if (fitTextWidth(doc, titleTxt, titleSize) > rightW) {
    titleSize = 12;
    doc.setFontSize(titleSize);
    titleLines = (doc.splitTextToSize(titleTxt, rightW) as string[]).slice(0, 2);
  }

  const twoLines = titleLines.length > 1;
  const titleTop = twoLines ? h / 2 - 6 : h / 2 - 1.5;
  doc.setFontSize(titleSize);
  doc.setTextColor(...DOC_WHITE);
  titleLines.forEach((line, i) => {
    doc.text(clampText(doc, line, rightW), rightX, titleTop + i * (titleSize * 0.42), { align: "right" });
  });

  let metaY = titleTop + (twoLines ? titleSize * 0.42 : 0) + 5.5;
  if (numero) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...DOC_GOLD);
    doc.text(clampText(doc, numero, rightW), rightX, metaY, { align: "right" });
    metaY += 4.5;
  }
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...DOC_GOLD_SOFT);
    const maxSubY = h - 3;
    if (metaY <= maxSubY) {
      doc.text(clampText(doc, subtitle, rightW), rightX, Math.min(metaY, maxSubY), { align: "right" });
    }
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

/** Titre de section navy (auto-pagination : jamais orphelin). */
export function drawSectionTitle(
  doc: jsPDF,
  pageW: number,
  y: number,
  label: string,
  opts?: { x?: number; w?: number },
): number {
  const x = opts?.x ?? 14;
  const w = opts?.w ?? pageW - 28;
  // un titre doit être suivi d'au moins une ligne de contenu
  y = docEnsureSpace(doc, y, 6.5 + 9);
  doc.setFillColor(...DOC_NAVY);
  doc.rect(x, y, w, 6.5, "F");
  doc.setTextColor(...DOC_WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(label.toUpperCase(), x + 4, y + 4.5);
  return y + 9.5;
}


/** Ligne "label / valeur" en tableau clair (modèles passage à vide / fiche mission). */
export function drawKeyValueRow(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  opts?: { labelW?: number; height?: number; gap?: number },
): number {
  const h = opts?.height ?? 6.8;
  const gap = opts?.gap ?? 1;
  const labelW = opts?.labelW ?? Math.min(55, w * 0.42);
  y = docEnsureSpace(doc, y, h + gap);
  doc.setFillColor(...DOC_CREAM);
  doc.rect(x, y, w, h, "F");
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(...DOC_NAVY);
  doc.text(label, x + 2.5, y + h / 2 + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.setTextColor(...DOC_TEXT);
  const maxW = w - labelW - 4;
  const raw = value || "—";
  doc.text(doc.getTextWidth(raw) <= maxW ? raw : clampText(doc, raw, maxW), x + labelW, y + h / 2 + 1);
  return y + h + gap;
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

export interface ClientBillingIdentity {
  societe: string | null;
  siret: string | null;
  tva: string | null;
  adresse: string | null;
  logo_url: string | null;
}

/**
 * Identité de facturation du client : l'ORGANISATION (société) prime toujours
 * sur le contact. Rétroactif : résolu au moment de la génération du document,
 * même pour les devis/factures créés avant le rattachement à une organisation.
 */
export async function resolveClientBillingIdentity(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<ClientBillingIdentity | null> {
  const { userId, email } = opts;
  if (!userId && !email) return null;
  try {
    let q = supabase
      .from("profiles")
      .select("user_id, societe, siret, tva_intra, adresse_facturation, adresse, logo_url, organization_id");
    q = userId ? q.eq("user_id", userId) : q.eq("email", email!);
    const { data: profile } = await q.limit(1).maybeSingle();
    if (!profile) return null;

    let orgId = (profile as any).organization_id as string | null;
    if (!orgId) {
      const { data: mem } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", (profile as any).user_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      orgId = mem?.organization_id ?? null;
    }

    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("legal_name, commercial_name, siret, vat_number, billing_address, logo_url")
        .eq("id", orgId)
        .maybeSingle();
      if (org) {
        return {
          societe: (org as any).legal_name || (org as any).commercial_name || null,
          siret: (org as any).siret || (profile as any).siret || null,
          tva: (org as any).vat_number || (profile as any).tva_intra || null,
          adresse: (org as any).billing_address || (profile as any).adresse_facturation || (profile as any).adresse || null,
          logo_url: (org as any).logo_url || (profile as any).logo_url || null,
        };
      }
    }

    const societe = ((profile as any).societe || "").trim();
    if (!societe) return null;
    return {
      societe,
      siret: (profile as any).siret || null,
      tva: (profile as any).tva_intra || null,
      adresse: (profile as any).adresse_facturation || (profile as any).adresse || null,
      logo_url: (profile as any).logo_url || null,
    };
  } catch {
    return null;
  }
}
