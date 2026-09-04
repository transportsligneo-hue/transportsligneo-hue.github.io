/**
 * Procès-verbal de livraison / restitution — génération PDF à partir des données
 * d'une mission existante.
 *
 * Le PV n'a PAS de compteur propre : il reprend strictement le numéro de mission
 * Transports Ligneo (`PV-LIV-<numéro mission>` / `PV-RES-<numéro mission>`), avec
 * un suffixe `-v2`, `-v3`… si plusieurs PV du même type sont établis.
 *
 * Ce document coexiste avec la fiche de mission, le bon de prise en charge et
 * l'état des lieux : il ne les remplace pas.
 */
import jsPDF from "jspdf";
import { LIGNEO_BRAND_LOGO as logoLigneo } from "@/lib/brand-assets";
import { EDL_CAR_SCHEMA_H, EDL_CAR_SCHEMA_PNG, EDL_CAR_SCHEMA_W } from "@/lib/edl-car-schema";
import {
  DOC_CREAM,
  DOC_GOLD,
  DOC_LINE,
  DOC_MUTED,
  DOC_NAVY,
  DOC_TEXT,
  DOC_WHITE,
  drawDocHeader,
  drawSectionTitle,
  fetchCompanyInfo,
  finalizeDoc,
  loadImageAsDataUrl,
  toSiren,
  type CompanyInfo,
} from "@/lib/doc-branding";
import { applyLigneoFonts } from "@/lib/pdf-fonts";
import { formatVin, normalizeVin } from "@/lib/vin";

export type PvVariant = "livraison" | "restitution";

/** Dommage repris de l'état des lieux de la mission (schéma pré-rempli). */
export interface PvDommage {
  /** Code légende : R, C, E, M, T, I… */
  code: string;
  /** Zone / vue concernée (ex. « Côté gauche »). */
  zone?: string | null;
  /** Commentaire libre du convoyeur. */
  note?: string | null;
}

export interface PvMissionData {
  /** Numéro de mission strictement identique à celui affiché dans l'app. */
  numero_mission: string;
  /** Numéro complet du PV (voir `pvNumero`). */
  numero_pv: string;
  donneur_ordre?: string | null;
  destinataire?: string | null;
  marque_modele?: string | null;
  immatriculation?: string | null;
  vin?: string | null;
  kilometrage_depart?: string | null;
  kilometrage_arrivee?: string | null;
  carburant?: string | null;
  lieu_prise_en_charge?: string | null;
  lieu_livraison?: string | null;
  date_prise_en_charge?: string | null;
  date_livraison?: string | null;
  /** Annotations de dommages issues de l'EDL — schéma vierge si vide. */
  dommages?: PvDommage[];
}

/** Numéro de PV dérivé du numéro de mission (jamais de compteur autonome). */
export function pvNumero(variant: PvVariant, numeroMission: string, version = 1): string {
  const prefix = variant === "livraison" ? "PV-LIV" : "PV-RES";
  const base = `${prefix}-${(numeroMission || "").trim() || "—"}`;
  return version > 1 ? `${base}-v${version}` : base;
}

const LEGENDE: [string, string][] = [
  ["R", "Rayure"],
  ["C", "Coup"],
  ["E", "Enfoncement"],
  ["M", "Manquant / Cassé"],
  ["T", "Tache"],
  ["I", "Impact (gravillon)"],
];

const DOCS_LIVRAISON: [string, string][] = [
  ["Clé principale", "Clé de secours"],
  ["Carte grise", "Attestation d'assurance"],
  ["État des lieux départ joint", "Accessoires (roue secours, triangle, gilet)"],
];

const DOCS_RESTITUTION: [string, string][] = [
  ["Clé principale", "Clé de secours"],
  ["Carte grise", "Carnet d'entretien"],
  ["État des lieux de départ joint", "Accessoires (roue secours, triangle, gilet)"],
];

function drawCheckbox(doc: jsPDF, x: number, y: number, size = 3.2, checked = false) {
  doc.setDrawColor(...DOC_NAVY);
  doc.setLineWidth(0.25);
  doc.setFillColor(...DOC_WHITE);
  doc.rect(x, y, size, size, "FD");
  if (checked) {
    doc.setLineWidth(0.5);
    doc.line(x + 0.7, y + size / 2, x + size * 0.42, y + size - 0.7);
    doc.line(x + size * 0.42, y + size - 0.7, x + size - 0.6, y + 0.7);
  }
}

/** Champ « Label » + valeur pré-remplie, ou trait à compléter si vide. */
function field(doc: jsPDF, x: number, y: number, w: number, label: string, value?: string | null): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...DOC_NAVY);
  doc.text(label, x, y);
  const v = (value ?? "").toString().trim();
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.25);
  doc.line(x, y + 5.4, x + w, y + 5.4);
  if (v) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...DOC_TEXT);
    doc.text(doc.splitTextToSize(v, w)[0] as string, x, y + 4.4);
  }
  return y + 8.6;
}

function cartouche(doc: jsPDF, x: number, y: number, w: number, h: number, titre: string, lignes: string[]) {
  doc.setFillColor(...DOC_CREAM);
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_NAVY);
  (doc.splitTextToSize(titre.toUpperCase(), w - 6) as string[]).slice(0, 2).forEach((l, i) => {
    doc.text(l, x + 3, y + 5 + i * 3.6);
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_TEXT);
  let ly = y + h - 4 - Math.max(0, lignes.length - 1) * 4;
  if (!lignes.length) {
    doc.setDrawColor(...DOC_LINE);
    doc.line(x + 3, y + h - 4, x + w - 3, y + h - 4);
  }
  lignes.forEach((l) => {
    doc.text(doc.splitTextToSize(l, w - 6)[0] as string, x + 3, ly);
    ly += 4;
  });
}

/** Mention L.133-3 adaptée au type de PV. */
function mentionText(isLiv: boolean): string {
  return isLiv
    ? "Conformément à l'article L.133-3 du Code de commerce, le destinataire dispose d'un délai de 48 heures, non compris les jours fériés, pour notifier au transporteur par lettre recommandée toute réserve motivée relative à l'état du véhicule qui n'aurait pas été mentionnée sur le présent procès-verbal au moment de la livraison. Passé ce délai, la livraison est réputée conforme et sans réserve."
    : "Conformément à l'article L.133-3 du Code de commerce, le propriétaire ou donneur d'ordre dispose d'un délai de 48 heures, non compris les jours fériés, pour notifier au transporteur par lettre recommandée toute réserve motivée relative à l'état du véhicule qui n'aurait pas été mentionnée sur le présent procès-verbal au moment de la restitution. Passé ce délai, la restitution est réputée conforme et sans réserve.";
}

export async function generatePvMissionPdf(
  variant: PvVariant,
  d: PvMissionData,
  company?: CompanyInfo | null,
): Promise<Blob> {
  const isLiv = variant === "livraison";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  applyLigneoFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const c = company ?? (await fetchCompanyInfo());
  const logo = await loadImageAsDataUrl(logoLigneo);
  drawDocHeader(doc, {
    pageW,
    logoData: logo,
    title: isLiv ? "Procès-verbal de livraison" : "Procès-verbal de restitution",
    numero: d.numero_pv,
    subtitle: `Mission ${d.numero_mission}`,
    company: c,
  });

  const w = pageW - 28;
  let y = 52;

  /* Parties */
  const cw = (w - 8) / 3;
  const siren = toSiren(c?.siret) || "753 320 001";
  cartouche(doc, 14, y, cw, 18, "Transporteur", [
    `${(c?.raison_sociale || "Transports Ligneo")} · SIREN ${siren}`,
  ]);
  cartouche(doc, 14 + cw + 4, y, cw, 18, isLiv ? "Donneur d'ordre / Expéditeur" : "Propriétaire / Donneur d'ordre",
    d.donneur_ordre ? [d.donneur_ordre] : []);
  cartouche(doc, 14 + (cw + 4) * 2, y, cw, 18, isLiv ? "Destinataire / Réceptionnaire" : "Restitué par (utilisateur / locataire)",
    d.destinataire ? [d.destinataire] : []);
  y += 22;

  /* Véhicule */
  y = drawSectionTitle(doc, pageW, y, "Véhicule");
  const c3 = (w - 12) / 3;
  const x2 = 14 + c3 + 6;
  const x3 = 14 + (c3 + 6) * 2;
  const vin = normalizeVin(d.vin);
  let yy = field(doc, 14, y, c3, "Marque / Modèle", d.marque_modele);
  field(doc, x2, y, c3, "Immatriculation", d.immatriculation);
  field(doc, x3, y, c3, "VIN", vin ? formatVin(vin) : null);
  y = yy;
  yy = field(doc, 14, y, c3, "N° mission Transports Ligneo", d.numero_mission);
  field(doc, x2, y, c3, isLiv ? "Kilométrage à la livraison" : "Kilométrage à la restitution", d.kilometrage_arrivee);
  field(doc, x3, y, c3, "Niveau carburant / batterie", null);
  y = yy + 1;

  if (!isLiv) {
    // Comparaison avec l'EDL de départ, intégrée au bloc véhicule.
    yy = field(doc, 14, y, c3, "Kilométrage au départ (EDL)", d.kilometrage_depart);
    field(doc, x2, y, c3, "Écart kilométrique", null);
    field(doc, x3, y, c3, "Carnet / entretien à jour", null);
    y = yy + 1;
  }

  /* Trajet */
  y = drawSectionTitle(doc, pageW, y, isLiv ? "Détails du trajet" : "Détails de la restitution");
  const c2 = (w - 6) / 2;
  const xR = 14 + c2 + 6;
  yy = field(doc, 14, y, c2, isLiv ? "Lieu de prise en charge" : "Lieu de mise à disposition initiale", d.lieu_prise_en_charge);
  field(doc, xR, y, c2, isLiv ? "Lieu de livraison" : "Lieu de restitution", d.lieu_livraison);
  y = yy;
  yy = field(doc, 14, y, c2, isLiv ? "Date / heure de prise en charge" : "Date / heure de mise à disposition", d.date_prise_en_charge);
  field(doc, xR, y, c2, isLiv ? "Date / heure de livraison" : "Date / heure de restitution", d.date_livraison);
  y = yy + 1;

  /* Conformité */
  const boxH = 9;
  doc.setFillColor(...DOC_NAVY);
  doc.roundedRect(14, y, c2, boxH, 1.5, 1.5, "F");
  doc.setDrawColor(...DOC_LINE);
  doc.setFillColor(...DOC_WHITE);
  doc.roundedRect(xR, y, c2, boxH, 1.5, 1.5, "FD");
  doc.setFillColor(...DOC_GOLD);
  doc.rect(19, y + 3, 3.2, 3.2, "F");
  drawCheckbox(doc, xR + 5, y + 3, 3.2, false);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_WHITE);
  doc.text(isLiv ? "Livraison conforme, sans réserve" : "Restitution conforme, sans réserve", 25, y + 5.8);
  doc.setTextColor(...DOC_NAVY);
  doc.text(isLiv ? "Livraison avec réserves (voir ci-dessous)" : "Restitution avec réserves (voir ci-dessous)", xR + 11, y + 5.8);
  y += boxH + 4;

  /* Réserves */
  doc.setFillColor(253, 250, 242);
  doc.setDrawColor(...DOC_GOLD);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, w, 12, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_GOLD);
  doc.text(
    isLiv ? "RÉSERVES CONSTATÉES PAR LE DESTINATAIRE" : "RÉSERVES / DOMMAGES CONSTATÉS À LA RESTITUTION",
    18,
    y + 5,
  );
  y += 12;

  /* Schéma des dommages + légende */
  const schemaTop = y + 2;
  const schemaW = 52;
  const schemaH = (schemaW * EDL_CAR_SCHEMA_H) / EDL_CAR_SCHEMA_W;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_NAVY);
  doc.text("SCHÉMA DES DOMMAGES CONSTATÉS", 14, schemaTop);
  doc.addImage(EDL_CAR_SCHEMA_PNG, "PNG", 16, schemaTop + 3, schemaW, schemaH, undefined, "FAST");

  const legendX = 100;
  const legendW = pageW - 14 - legendX;
  const legendH = Math.max(schemaH + 7, LEGENDE.length * 4.2 + 12);
  doc.setFillColor(...DOC_NAVY);
  doc.roundedRect(legendX, schemaTop - 3, legendW, 7, 1.5, 1.5, "F");
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.3);
  doc.rect(legendX, schemaTop + 4, legendW, legendH - 7, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_GOLD);
  doc.text("LÉGENDE", legendX + legendW / 2, schemaTop + 1.5, { align: "center" });
  let ly = schemaTop + 10;
  LEGENDE.forEach(([code, label]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...DOC_GOLD);
    doc.text(`(${code})`, legendX + 4, ly);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DOC_TEXT);
    doc.text(label, legendX + 13, ly);
    ly += 4.0;
  });

  y = Math.max(schemaTop + schemaH + 6, schemaTop + legendH + 4);

  const dommages = (d.dommages ?? []).slice(0, 6);
  if (dommages.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...DOC_NAVY);
    doc.text("DOMMAGES RELEVÉS À L'ÉTAT DES LIEUX DE CETTE MISSION", 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...DOC_TEXT);
    dommages.forEach((dm) => {
      const line = [`(${dm.code})`, dm.zone, dm.note].filter(Boolean).join(" — ");
      doc.text(doc.splitTextToSize(line, w)[0] as string, 14, y);
      y += 3.6;
    });
    y += 2;
  }

  /* Documents, mention légale et signatures : jamais à cheval sur le pied de page. */
  const pageH = doc.internal.pageSize.getHeight();
  const mentionLines = (doc.splitTextToSize(mentionText(isLiv), w) as string[]).length;
  const need =
    10 + (isLiv ? DOCS_LIVRAISON : DOCS_RESTITUTION).length * 5 + 2 + mentionLines * 3.2 + 4 + 21;
  console.log("[pv]", isLiv, "y", y.toFixed(1), "need", need.toFixed(1), "limit", pageH - 14);
  if (y + need > pageH - 14) {

    doc.addPage();
    y = 30;
  }

  /* Documents et accessoires */
  y = drawSectionTitle(doc, pageW, y, isLiv ? "Documents et accessoires remis" : "Documents et accessoires restitués");
  (isLiv ? DOCS_LIVRAISON : DOCS_RESTITUTION).forEach(([l, r]) => {
    drawCheckbox(doc, 16, y - 2.6, 3.2, false);
    drawCheckbox(doc, xR, y - 2.6, 3.2, false);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...DOC_TEXT);
    doc.text(l, 21, y);
    doc.text(r, xR + 5, y);
    y += 5;
  });
  y += 2;

  /* Mention légale */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(...DOC_MUTED);
  const mention = mentionText(isLiv);
  (doc.splitTextToSize(mention, w) as string[]).forEach((l) => {
    doc.text(l, 14, y);
    y += 3.05;
  });
  y += 3;

  /* Signatures */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_NAVY);
  doc.text("Signature du convoyeur", 14, y);
  doc.text(isLiv ? "Signature du destinataire" : "Signature du propriétaire / donneur d'ordre", xR, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(...DOC_MUTED);
  doc.text(
    isLiv
      ? "Certifie la livraison du véhicule dans les conditions décrites ci-dessus"
      : "Certifie la restitution du véhicule dans les conditions décrites ci-dessus",
    14,
    y + 4,
  );
  doc.text(
    isLiv
      ? "Certifie la réception du véhicule et l'exactitude des informations ci-dessus"
      : "Certifie la reprise du véhicule et l'exactitude des informations ci-dessus",
    xR,
    y + 4,
  );
  const sigY = y + 14;
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.3);
  doc.line(14, sigY, 14 + c2, sigY);
  doc.line(xR, sigY, xR + c2, sigY);
  doc.setFontSize(6.4);
  doc.text("Nom, date et signature", 14, sigY + 3.5);
  doc.text("Nom, date et signature", xR, sigY + 3.5);

  finalizeDoc(doc, c);
  return doc.output("blob");
}
