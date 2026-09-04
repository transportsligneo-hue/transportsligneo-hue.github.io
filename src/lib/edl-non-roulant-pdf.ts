/**
 * Bon de prise en charge — véhicule NON ROULANT (transport sur plateau).
 *
 * Document volontairement minimal, calqué sur le bon papier existant :
 * en-tête navy + liseré or, cartouches mission / véhicule, contrôles
 * d'arrimage, 4 photos extérieures annotées, légende, double signature.
 *
 * ⚠️ Ce générateur est INDÉPENDANT de l'EDL roulant (edl-final-pdf.ts).
 */
import jsPDF from "jspdf";
import { LIGNEO_BRAND_LOGO as logoLigneo } from "@/lib/brand-assets";
import {
  DOC_CREAM,
  DOC_GOLD,
  DOC_LINE,
  DOC_MUTED,
  DOC_NAVY,
  DOC_TEXT,
  DOC_WHITE,
  drawDocHeader,
  drawKeyValueRow,
  drawSectionTitle,
  fetchCompanyInfo,
  finalizeDoc,
  loadImageAsDataUrl,
  type CompanyInfo,
} from "@/lib/doc-branding";
import { applyLigneoFonts } from "@/lib/pdf-fonts";

/** Codes de dommage, identiques au bon papier. */
export const DAMAGE_CODES = [
  { code: "R", label: "Rayure" },
  { code: "C", label: "Coup" },
  { code: "E", label: "Enfoncement" },
  { code: "M", label: "Manquant / Cassé" },
  { code: "T", label: "Tache" },
] as const;

export type DamageCode = (typeof DAMAGE_CODES)[number]["code"];

/** Les 4 seuls angles de ce parcours. */
export const NR_VIEWS = [
  { id: "face_avant", label: "Face avant" },
  { id: "face_arriere", label: "Face arrière" },
  { id: "cote_gauche", label: "Côté gauche" },
  { id: "cote_droit", label: "Côté droit" },
] as const;

export type NrViewId = (typeof NR_VIEWS)[number]["id"];

/** Points d'arrimage à cocher avant les photos. */
export const ARRIMAGE_ITEMS = [
  { id: "sangles_avant", label: "Sangles avant posées et tendues" },
  { id: "sangles_arriere", label: "Sangles arrière posées et tendues" },
  { id: "cales_roues", label: "Cales roues en place" },
  { id: "points_arrimage", label: "Points d'arrimage vérifiés" },
] as const;

export interface NrAnnotation {
  /** Position relative dans la photo (0 → 1). */
  x: number;
  y: number;
  code: DamageCode;
}

export interface NrPhoto {
  vue: NrViewId;
  /** Data URL JPEG/PNG de la photo. */
  dataUrl?: string | null;
  annotations: NrAnnotation[];
}

export interface NrSignature {
  nom?: string | null;
  dataUrl?: string | null;
  signedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface EdlNonRoulantPdfData {
  numero: string;
  date?: string | null;
  convoyeur_nom?: string | null;
  remettant_nom?: string | null;
  lieu_prise_en_charge?: string | null;
  destination?: string | null;
  marque?: string | null;
  modele?: string | null;
  immatriculation?: string | null;
  vin?: string | null;
  arrimage: Record<string, boolean>;
  photos: NrPhoto[];
  observations?: string | null;
  signature_convoyeur?: NrSignature | null;
  signature_remettant?: NrSignature | null;
}

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

const fmtGeo = (s?: NrSignature | null) =>
  s?.latitude != null && s?.longitude != null
    ? `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`
    : "position non disponible";

function checkbox(doc: jsPDF, x: number, y: number, checked: boolean, label: string) {
  const size = 3.4;
  doc.setDrawColor(...DOC_NAVY);
  doc.setLineWidth(0.3);
  doc.rect(x, y - size + 0.6, size, size, "S");
  if (checked) {
    doc.setDrawColor(...DOC_NAVY);
    doc.setLineWidth(0.55);
    doc.line(x + 0.6, y - size / 2 + 0.5, x + size * 0.42, y + 0.1);
    doc.line(x + size * 0.42, y + 0.1, x + size - 0.5, y - size + 1.2);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...DOC_TEXT);
  doc.text(label, x + size + 2.4, y);
}

/** Photo + pastilles de dommages numérotées par lettre. */
function drawAnnotatedPhoto(
  doc: jsPDF,
  photo: NrPhoto,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.setFillColor(...DOC_CREAM);
  doc.rect(x, y, w, h, "F");
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h, "S");

  if (photo.dataUrl) {
    try {
      doc.addImage(photo.dataUrl, "JPEG", x + 0.6, y + 0.6, w - 1.2, h - 1.2, undefined, "FAST");
    } catch {
      /* photo optionnelle */
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...DOC_MUTED);
    doc.text("Photo non disponible", x + w / 2, y + h / 2, { align: "center" });
  }

  for (const a of photo.annotations ?? []) {
    const cx = x + Math.min(Math.max(a.x, 0), 1) * w;
    const cy = y + Math.min(Math.max(a.y, 0), 1) * h;
    doc.setFillColor(...DOC_GOLD);
    doc.circle(cx, cy, 2.1, "F");
    doc.setDrawColor(...DOC_NAVY);
    doc.setLineWidth(0.3);
    doc.circle(cx, cy, 2.1, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...DOC_NAVY);
    doc.text(a.code, cx, cy + 1.1, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_NAVY);
  doc.text(label.toUpperCase(), x, y + h + 3.6);
}

function drawSignatureBlock(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  sig?: NrSignature | null,
) {
  const h = 30;
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(...DOC_NAVY);
  doc.text(title.toUpperCase(), x + 2.5, y + 4.5);

  if (sig?.dataUrl) {
    try {
      doc.addImage(sig.dataUrl, "PNG", x + 2.5, y + 6, Math.min(w - 5, 52), 14);
    } catch {
      /* signature optionnelle */
    }
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(...DOC_TEXT);
  doc.text(sig?.nom || "—", x + 2.5, y + 24);
  doc.setTextColor(...DOC_MUTED);
  doc.text(`${fmtDateTime(sig?.signedAt)} · ${fmtGeo(sig)}`, x + 2.5, y + 27.5);
}

export async function generateEdlNonRoulantPdf(
  d: EdlNonRoulantPdfData,
  company?: CompanyInfo | null,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  applyLigneoFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const c = company ?? (await fetchCompanyInfo());
  const logo = await loadImageAsDataUrl(logoLigneo);

  drawDocHeader(doc, {
    pageW,
    logoData: logo,
    title: "Bon de prise en charge",
    subtitle: "Véhicule non roulant — transport sur plateau",
    numero: d.numero,
    company: c,
  });

  const w = pageW - 28;
  let y = 52;

  // Bandeau statut
  doc.setFillColor(...DOC_NAVY);
  doc.rect(14, y, w, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...DOC_GOLD);
  doc.text("VÉHICULE NON ROULANT · TRANSPORT SUR PLATEAU", 17, y + 4.7);
  doc.setTextColor(...DOC_WHITE);
  doc.text(fmtDateTime(d.date ?? new Date().toISOString()), pageW - 17, y + 4.7, { align: "right" });
  y += 11;

  // 1 — Mission
  y = drawSectionTitle(doc, pageW, y, "1. Mission & parties");
  const colW = (w - 6) / 2;
  const xR = 14 + colW + 6;
  let yl = y;
  let yr = y;
  yl = drawKeyValueRow(doc, 14, yl, colW, "N° mission", d.numero);
  yl = drawKeyValueRow(doc, 14, yl, colW, "Convoyeur", d.convoyeur_nom || "—");
  yl = drawKeyValueRow(doc, 14, yl, colW, "Lieu de prise en charge", d.lieu_prise_en_charge || "—");
  yr = drawKeyValueRow(doc, xR, yr, colW, "Remis par", d.remettant_nom || "—");
  yr = drawKeyValueRow(doc, xR, yr, colW, "Destination prévue", d.destination || "—");
  yr = drawKeyValueRow(doc, xR, yr, colW, "Date / heure", fmtDateTime(d.date ?? new Date().toISOString()));
  y = Math.max(yl, yr) + 2;

  // 2 — Véhicule
  y = drawSectionTitle(doc, pageW, y, "2. Véhicule");
  yl = y;
  yr = y;
  yl = drawKeyValueRow(doc, 14, yl, colW, "Marque", d.marque || "—");
  yl = drawKeyValueRow(doc, 14, yl, colW, "Modèle", d.modele || "—");
  yr = drawKeyValueRow(doc, xR, yr, colW, "Immatriculation", d.immatriculation || "—");
  yr = drawKeyValueRow(doc, xR, yr, colW, "VIN", d.vin || "—");
  y = Math.max(yl, yr) + 2;

  // 3 — Arrimage
  y = drawSectionTitle(doc, pageW, y, "3. Transport sur plateau — contrôles d'arrimage");
  const ay = y + 3;
  ARRIMAGE_ITEMS.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    checkbox(doc, 14 + col * colW + 4, ay + row * 6, !!d.arrimage?.[item.id], item.label);
  });
  y = ay + Math.ceil(ARRIMAGE_ITEMS.length / 2) * 6 + 2;

  // 4 — Photos annotées
  y = drawSectionTitle(doc, pageW, y, "4. Photos extérieures & dommages constatés");
  const pw = (w - 6) / 2;
  const ph = 42;
  NR_VIEWS.forEach((v, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const photo = d.photos.find((p) => p.vue === v.id) ?? { vue: v.id, dataUrl: null, annotations: [] };
    drawAnnotatedPhoto(doc, photo, v.label, 14 + col * (pw + 6), y + row * (ph + 8), pw, ph);
  });
  y += 2 * (ph + 8) + 1;

  // Légende
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_NAVY);
  doc.text("LÉGENDE :", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DOC_TEXT);
  doc.text(DAMAGE_CODES.map((c2) => `${c2.code} ${c2.label}`).join("   ·   "), 32, y);
  y += 6;

  // 5 — Observations
  y = drawSectionTitle(doc, pageW, y, "5. Observations particulières");
  const obs = (d.observations || "Aucune observation particulière.").trim();
  const lines = doc.splitTextToSize(obs, w - 5) as string[];
  const obsH = Math.max(14, lines.length * 4 + 5);
  doc.setFillColor(...DOC_CREAM);
  doc.rect(14, y, w, obsH, "F");
  doc.setDrawColor(...DOC_LINE);
  doc.rect(14, y, w, obsH, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...DOC_TEXT);
  doc.text(lines, 16.5, y + 5);
  y += obsH + 4;

  // 6 — Signatures
  y = drawSectionTitle(doc, pageW, y, "6. Signatures");
  drawSignatureBlock(doc, 14, y, colW, "Signature du convoyeur", d.signature_convoyeur);
  drawSignatureBlock(doc, xR, y, colW, "Signature du remettant", d.signature_remettant);

  finalizeDoc(doc, c);
  return doc.output("blob");
}
