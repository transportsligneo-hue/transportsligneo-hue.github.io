/**
 * Mandat / décharge de récupération de véhicule.
 *
 * Document signé par le propriétaire (mandant) autorisant Transports Ligneo à
 * récupérer un véhicule sur un lieu donné (fourrière, garage, concession,
 * domicile…). Il reprend l'identité de l'entreprise, le véhicule et la mission,
 * et deux emplacements de signature fixes (mandant / mandataire).
 */
import jsPDF from "jspdf";
import { LIGNEO_BRAND_LOGO as logoLigneo } from "@/lib/brand-assets";
import {
  fetchCompanyInfo,
  loadImageAsDataUrl,
  toSiren,
  type CompanyInfo,
} from "@/lib/doc-branding";
import { applyLigneoFonts } from "@/lib/pdf-fonts";
import { formatVin, normalizeVin } from "@/lib/vin";
import { SIGNATURE_PRINT_H, SIGNATURE_PRINT_W } from "@/lib/signature-slots";

const INK: [number, number, number] = [17, 22, 38];
const BLUE: [number, number, number] = [37, 91, 235];
const TEXT: [number, number, number] = [55, 60, 74];
const MUTED: [number, number, number] = [128, 134, 148];
const BORDER: [number, number, number] = [223, 227, 236];
const PANEL: [number, number, number] = [247, 249, 253];

const M = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const W = PAGE_W - M * 2;

export interface MandatRecuperationData {
  numero_mission: string;
  numero_mandat: string;
  /** Mandant : propriétaire / donneur d'ordre. */
  mandant_nom?: string | null;
  mandant_societe?: string | null;
  mandant_adresse?: string | null;
  mandant_tel?: string | null;
  mandant_email?: string | null;
  marque_modele?: string | null;
  immatriculation?: string | null;
  vin?: string | null;
  lieu_recuperation?: string | null;
  motif?: string | null;
  destination?: string | null;
  date_prevue?: string | null;
  convoyeur_nom?: string | null;
  /** Signatures déjà collectées (data URL PNG). */
  signatures?: { mandant?: string | null; mandataire?: string | null };
}

/** Numéro de mandat : reprend strictement le numéro de mission. */
export function mandatNumero(numeroMission: string, version = 1): string {
  const base = `MDT-${numeroMission.replace(/^MIS-/, "")}`;
  return version > 1 ? `${base}-v${version}` : base;
}

function panel(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...PANEL);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2.4, 2.4, "FD");
}

function field(doc: jsPDF, label: string, value: string | null | undefined, x: number, y: number, w: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  const lines = doc.splitTextToSize(value && String(value).trim() ? String(value) : "—", w) as string[];
  lines.slice(0, 2).forEach((l, i) => doc.text(l, x, y + 4.6 + i * 4);
  );
  return y + 4.6 + Math.min(lines.length, 2) * 4;
}

export async function generateMandatRecuperationPdf(
  d: MandatRecuperationData,
  company?: CompanyInfo | null,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: [PAGE_W, PAGE_H] });
  applyLigneoFonts(doc);
  const c = company ?? (await fetchCompanyInfo());
  const logo = await loadImageAsDataUrl(logoLigneo);
  const right = PAGE_W - M;

  /* En-tête */
  if (logo) doc.addImage(logo, "PNG", M, 12, 15, 15, undefined, "FAST");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text("TRANSPORTS ", M + 19, 20.5);
  const wT = doc.getTextWidth("TRANSPORTS ");
  doc.setTextColor(...BLUE);
  doc.text("LIGNEO", M + 19 + wT, 20.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...MUTED);
  doc.text(
    [c?.adresse_ligne1, [c?.adresse_cp, c?.adresse_ville].filter(Boolean).join(" ")].filter(Boolean).join(" · ") ||
      "Convoyage automobile B2B",
    M + 19,
    25.5,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.5);
  doc.setTextColor(...INK);
  doc.text("MANDAT DE RÉCUPÉRATION", right, 19.5, { align: "right" });
  doc.setFontSize(10.5);
  doc.setTextColor(...BLUE);
  doc.text(d.numero_mandat, right, 25.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...TEXT);
  doc.text(`Mission ${d.numero_mission}`, right, 31, { align: "right" });

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.line(M, 35, right, 35);

  let y = 41;

  /* Mandant */
  const colW = (W - 6) / 2;
  panel(doc, M, y, W, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text("LE MANDANT (propriétaire / donneur d'ordre)", M + 5, y + 6);
  field(doc, "Nom", d.mandant_nom, M + 5, y + 12, colW - 8);
  field(doc, "Société", d.mandant_societe, M + 5 + colW, y + 12, colW - 8);
  field(doc, "Adresse", d.mandant_adresse, M + 5, y + 21, colW - 8);
  field(
    doc,
    "Contact",
    [d.mandant_tel, d.mandant_email].filter(Boolean).join(" · "),
    M + 5 + colW,
    y + 21,
    colW - 8,
  );
  y += 34;

  /* Mandataire */
  panel(doc, M, y, W, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text("LE MANDATAIRE", M + 5, y + 6);
  field(doc, "Société", c?.raison_sociale ?? "Transports Ligneo", M + 5, y + 12, colW - 8);
  field(
    doc,
    "SIREN / SIRET",
    [toSiren(c?.siret ?? null), c?.siret].filter(Boolean).join(" · "),
    M + 5 + colW,
    y + 12,
    colW - 8,
  );
  y += 26;

  /* Véhicule et récupération */
  panel(doc, M, y, W, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text("VÉHICULE ET LIEU DE RÉCUPÉRATION", M + 5, y + 6);
  field(doc, "Marque / modèle", d.marque_modele, M + 5, y + 12, colW - 8);
  field(doc, "Immatriculation", d.immatriculation, M + 5 + colW, y + 12, colW - 8);
  field(doc, "N° de série (VIN)", d.vin ? formatVin(normalizeVin(d.vin)) : null, M + 5, y + 21, colW - 8);
  field(doc, "Date prévue", d.date_prevue, M + 5 + colW, y + 21, colW - 8);
  field(doc, "Lieu de récupération", d.lieu_recuperation, M + 5, y + 30, colW - 8);
  field(doc, "Motif", d.motif, M + 5 + colW, y + 30, colW - 8);
  y += 44;

  /* Texte du mandat */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...TEXT);
  const corps = [
    `Je soussigné(e) ${d.mandant_nom || "……………………………………"}, agissant en qualité de propriétaire ou de représentant dûment habilité du véhicule désigné ci-dessus, donne mandat à ${c?.raison_sociale ?? "Transports Ligneo"} de récupérer ce véhicule au lieu indiqué et de l'acheminer jusqu'à sa destination${d.destination ? ` : ${d.destination}` : ""}.`,
    `Ce mandat vaut décharge : il autorise le convoyeur mandaté${d.convoyeur_nom ? ` (${d.convoyeur_nom})` : ""} à prendre possession du véhicule, de ses clés et de ses documents de bord, et à signer tout document nécessaire à sa libération auprès du détenteur (garage, fourrière, concession, expert).`,
    "Le mandant certifie l'exactitude des informations portées au présent mandat et garantit disposer des droits nécessaires sur le véhicule. Un état des lieux contradictoire est établi lors de la prise en charge.",
  ];
  corps.forEach((p) => {
    const lines = doc.splitTextToSize(p, W) as string[];
    lines.forEach((l) => {
      doc.text(l, M, y);
      y += 4.4;
    });
    y += 2.4;
  });

  y += 4;

  /* Signatures */
  const sigH = SIGNATURE_PRINT_H + 16;
  const sigW = (W - 6) / 2;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, sigW, sigH, 2.4, 2.4, "S");
  doc.roundedRect(M + sigW + 6, y, sigW, sigH, 2.4, 2.4, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text("SIGNATURE DU MANDANT", M + 5, y + 6);
  doc.text("POUR TRANSPORTS LIGNEO", M + sigW + 11, y + 6);

  if (d.signatures?.mandant) {
    try {
      doc.addImage(d.signatures.mandant, "PNG", M + 5, y + 8, SIGNATURE_PRINT_W, SIGNATURE_PRINT_H);
    } catch { /* signature optionnelle */ }
  }
  if (d.signatures?.mandataire) {
    try {
      doc.addImage(d.signatures.mandataire, "PNG", M + sigW + 11, y + 8, SIGNATURE_PRINT_W, SIGNATURE_PRINT_H);
    } catch { /* signature optionnelle */ }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("Nom, date et signature", M + 5, y + sigH - 3.5);
  doc.text(c?.signataire_nom ?? "Nom, date et signature", M + sigW + 11, y + sigH - 3.5);

  /* Pied de page */
  const footY = PAGE_H - 14;
  doc.setDrawColor(...BORDER);
  doc.line(M, footY, right, footY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text(
    [c?.raison_sociale, c?.forme_juridique, c?.siret ? `SIRET ${c.siret}` : null, c?.tva_intra]
      .filter(Boolean)
      .join(" · "),
    M,
    footY + 5,
  );

  return doc.output("blob");
}
