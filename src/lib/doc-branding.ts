import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

/**
 * Charte documentaire officielle Transports Ligneo — utilisée par TOUS les PDF.
 * Version claire « nouvelle génération », alignée sur les devis, factures et PV :
 * encre profonde, bleu Ligneo en accent, panneaux gris très clairs.
 */
export const DOC_NAVY: [number, number, number] = [17, 22, 38];
export const DOC_NAVY_SOFT: [number, number, number] = [12, 21, 55];
/** Accent principal (anciennement doré) — désormais le bleu Ligneo. */
export const DOC_GOLD: [number, number, number] = [37, 91, 235];
export const DOC_GOLD_SOFT: [number, number, number] = [128, 134, 148];
export const DOC_TEXT: [number, number, number] = [55, 60, 74];
export const DOC_MUTED: [number, number, number] = [128, 134, 148];
export const DOC_LINE: [number, number, number] = [223, 228, 238];
export const DOC_WHITE: [number, number, number] = [255, 255, 255];
/** Panneau clair des tableaux clé/valeur. */
export const DOC_CREAM: [number, number, number] = [246, 248, 252];

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

/** En-tête compact et clair des pages de continuation. */
function drawContinuationHeader(doc: jsPDF, ctx: DocCtx) {
  const h = 20;
  if (ctx.logoData) {
    try {
      doc.addImage(ctx.logoData, "PNG", 14, 5, 11, 11);
    } catch {
      /* logo optionnel */
    }
  }
  doc.setTextColor(...DOC_NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(ctx.title.toUpperCase(), ctx.logoData ? 28 : 14, h / 2 + 1.2);
  if (ctx.numero) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DOC_GOLD);
    doc.text(ctx.numero, ctx.pageW - 14, h / 2 + 1.2, { align: "right" });
  }
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.3);
  doc.line(14, h, ctx.pageW - 14, h);
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

/**
 * En-tête clair « nouvelle génération » : logo + TRANSPORTS LIGNEO à gauche,
 * titre du document, numéro et sous-titre à droite, filet fin de séparation.
 * Identique au rendu des devis, factures et PV.
 */
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
  const h = opts.height ?? 40;
  const leftX = 14;
  const rightX = pageW - 14;

  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", leftX, 12, 14, 14);
    } catch {
      /* logo optionnel */
    }
  }

  const tx = logoData ? leftX + 18 : leftX;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.8);
  doc.setTextColor(...DOC_NAVY);
  doc.text("TRANSPORTS ", tx, 19.6);
  const w1 = doc.getTextWidth("TRANSPORTS ");
  doc.setTextColor(...DOC_GOLD);
  doc.text("LIGNEO", tx + w1, 19.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...DOC_MUTED);
  const baseline = company?.adresse_ville
    ? `Convoyage automobile — ${company.adresse_ville}, France`
    : "Convoyage automobile — France & Europe";
  doc.text(baseline, tx, 24.4);

  // --- Bloc titre à droite
  const rightW = rightX - (tx + 62);
  const titleTxt = title.toUpperCase();
  let titleSize = 15.5;
  doc.setFont("helvetica", "bold");
  while (titleSize > 9 && fitTextWidth(doc, titleTxt, titleSize) > rightW) titleSize -= 0.5;
  let titleLines: string[] = [titleTxt];
  if (fitTextWidth(doc, titleTxt, titleSize) > rightW) {
    titleSize = 11;
    doc.setFontSize(titleSize);
    titleLines = (doc.splitTextToSize(titleTxt, rightW) as string[]).slice(0, 2);
  }
  doc.setFontSize(titleSize);
  doc.setTextColor(...DOC_NAVY);
  titleLines.forEach((line, i) => {
    doc.text(clampText(doc, line, rightW), rightX, 19.6 + i * (titleSize * 0.44), { align: "right" });
  });

  let metaY = 19.6 + (titleLines.length - 1) * (titleSize * 0.44) + 5.4;
  if (numero) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.2);
    doc.setTextColor(...DOC_GOLD);
    doc.text(clampText(doc, numero, rightW), rightX, metaY, { align: "right" });
    metaY += 4.4;
  }
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...DOC_MUTED);
    if (metaY <= h - 3) {
      doc.text(clampText(doc, subtitle, rightW), rightX, metaY, { align: "right" });
    }
  }

  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.3);
  doc.line(leftX, h - 5, rightX, h - 5);
}

/** Pied de page légal dynamique (aucune mention codée en dur). */
export function drawDocLegalFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  company?: CompanyInfo | null,
) {
  const top = pageH - 20;
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.3);
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

/** Titre de section clair : panneau arrondi + repère bleu (jamais orphelin). */
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
  doc.setFillColor(...DOC_CREAM);
  doc.roundedRect(x, y, w, 6.8, 1.8, 1.8, "F");
  doc.setFillColor(...DOC_GOLD);
  doc.roundedRect(x + 2.4, y + 1.6, 1.4, 3.6, 0.7, 0.7, "F");
  doc.setTextColor(...DOC_NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.text(label.toUpperCase(), x + 6, y + 4.6);
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
  doc.roundedRect(x, y, w, h, 1.6, 1.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.9);
  doc.setTextColor(...DOC_MUTED);
  doc.text(label.toUpperCase(), x + 2.8, y + h / 2 + 1);
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
