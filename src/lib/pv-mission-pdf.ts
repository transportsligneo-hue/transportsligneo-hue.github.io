/**
 * Procès-verbal de livraison / restitution — génération PDF à partir des données
 * d'une mission existante.
 *
 * La mise en page reproduit au pixel près les gabarits papier Transports Ligneo
 * (en-tête logo + titre, cartouches parties, panneaux gris clair, schéma 4 vues,
 * légende navy/or, mention L.133-3, signatures).
 *
 * Le PV n'a PAS de compteur propre : il reprend strictement le numéro de mission
 * (`PV-LIV-<numéro>` / `PV-RES-<numéro>`), suffixé `-v2`, `-v3`… si plusieurs PV
 * du même type sont établis.
 */
import jsPDF from "jspdf";
import { LIGNEO_BRAND_LOGO as logoLigneo } from "@/lib/brand-assets";
import {
  CAR_COTE_DROIT_H,
  CAR_COTE_DROIT_PNG,
  CAR_COTE_DROIT_W,
  CAR_COTE_GAUCHE_H,
  CAR_COTE_GAUCHE_PNG,
  CAR_COTE_GAUCHE_W,
  CAR_FACE_ARRIERE_H,
  CAR_FACE_ARRIERE_PNG,
  CAR_FACE_ARRIERE_W,
  CAR_FACE_AVANT_H,
  CAR_FACE_AVANT_PNG,
  CAR_FACE_AVANT_W,
} from "@/lib/edl-car-views";
import {
  fetchCompanyInfo,
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

/* ------------------------------------------------------------------ charte */

const INK: [number, number, number] = [17, 22, 38];
const NAVY: [number, number, number] = [12, 21, 55];
const BLUE: [number, number, number] = [37, 91, 235];
const GOLD: [number, number, number] = [186, 138, 45];
const CREAM: [number, number, number] = [253, 249, 238];
const PANEL: [number, number, number] = [244, 246, 250];
const BORDER: [number, number, number] = [223, 228, 238];
const RULE: [number, number, number] = [205, 211, 224];
const TEXT: [number, number, number] = [55, 60, 74];
const MUTED: [number, number, number] = [128, 134, 148];
const WHITE: [number, number, number] = [255, 255, 255];

const M = 14;
const PAGE_W = 210;
const W = PAGE_W - M * 2;
const XR = M + W / 2 + 3;
const COL2 = W / 2 - 3;

const LEGENDE: [string, string][] = [
  ["R", "Rayure"],
  ["C", "Coup"],
  ["E", "Enfoncement"],
  ["M", "Manquant / Cassé"],
  ["T", "Tache"],
  ["I", "Impact (gravillon)"],
];

const VUES: [string, string, number, number][] = [
  [CAR_FACE_AVANT_PNG, "Face avant", CAR_FACE_AVANT_W, CAR_FACE_AVANT_H],
  [CAR_COTE_GAUCHE_PNG, "Côté gauche", CAR_COTE_GAUCHE_W, CAR_COTE_GAUCHE_H],
  [CAR_FACE_ARRIERE_PNG, "Face arrière", CAR_FACE_ARRIERE_W, CAR_FACE_ARRIERE_H],
  [CAR_COTE_DROIT_PNG, "Côté droit", CAR_COTE_DROIT_W, CAR_COTE_DROIT_H],
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

/* ------------------------------------------------------------------ helpers */

function panel(doc: jsPDF, x: number, y: number, w: number, h: number, fill = PANEL) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, 2.2, 2.2, "F");
}

function panelTitle(doc: jsPDF, x: number, y: number, label: string, color = INK) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...color);
  doc.text(label.toUpperCase(), x, y);
}

/** Libellé gras + valeur pré-remplie posée sur un trait à compléter. */
function field(doc: jsPDF, x: number, y: number, w: number, label: string, value?: string | null) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(...INK);
  doc.text(label, x, y);
  const v = (value ?? "").toString().trim();
  if (v) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...TEXT);
    doc.text(doc.splitTextToSize(v, w)[0] as string, x, y + 4.6);
  }
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.25);
  doc.line(x, y + 5.8, x + w, y + 5.8);
}

function checkbox(doc: jsPDF, x: number, y: number, size = 3.4) {
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.setFillColor(...WHITE);
  doc.roundedRect(x, y, size, size, 0.5, 0.5, "FD");
}

/** Mention L.133-3 adaptée au type de PV. */
function mentionText(isLiv: boolean): string {
  return isLiv
    ? "Conformément à l'article L.133-3 du Code de commerce, le destinataire dispose d'un délai de 48 heures, non compris les jours fériés, pour notifier au transporteur par lettre recommandée toute réserve motivée relative à l'état du véhicule qui n'aurait pas été mentionnée sur le présent procès-verbal au moment de la livraison. Passé ce délai, la livraison est réputée conforme et sans réserve."
    : "Conformément à l'article L.133-3 du Code de commerce, le propriétaire ou donneur d'ordre dispose d'un délai de 48 heures, non compris les jours fériés, pour notifier au transporteur par lettre recommandée toute réserve motivée relative à l'état du véhicule qui n'aurait pas été mentionnée sur le présent procès-verbal au moment de la restitution. Passé ce délai, la restitution est réputée conforme et sans réserve.";
}

/* ------------------------------------------------------------------ document */

export async function generatePvMissionPdf(
  variant: PvVariant,
  d: PvMissionData,
  company?: CompanyInfo | null,
): Promise<Blob> {
  const isLiv = variant === "livraison";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  applyLigneoFonts(doc);
  const c = company ?? (await fetchCompanyInfo());
  const logo = await loadImageAsDataUrl(logoLigneo);

  /* ---------- En-tête ---------- */
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
  const ville = [c?.adresse_cp?.slice(0, 2), c?.adresse_ville].filter(Boolean).length
    ? `${c?.adresse_ville ?? ""} (${(c?.adresse_cp ?? "").slice(0, 2)})`
    : "Tours (37)";
  doc.text(`Convoyage automobile B2B · ${ville}`, M + 19, 25.5);

  const right = PAGE_W - M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.5);
  doc.setTextColor(...INK);
  doc.text(isLiv ? "PROCÈS-VERBAL DE LIVRAISON" : "PROCÈS-VERBAL DE RESTITUTION", right, 19.5, { align: "right" });
  doc.setFontSize(10.5);
  doc.setTextColor(...BLUE);
  doc.text(d.numero_pv, right, 25.5, { align: "right" });
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.3);
  doc.line(right - doc.getTextWidth(d.numero_pv), 26.6, right, 26.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...TEXT);
  const annee = new Date().getFullYear();
  doc.text(`Date : ____ / ____ / ${annee}    Heure : ____ h ____`, right, 31.5, { align: "right" });

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.line(M, 35, right, 35);

  const sp = isLiv ? 4.4 : 2.6;
  let y = 38;

  /* ---------- Parties ---------- */
  const cw = (W - 10) / 3;
  const siren = toSiren(c?.siret) || "753 320 001";
  const parties: [string, string | null][] = [
    ["Transporteur", `${c?.raison_sociale || "Transports Ligneo"} · SIREN ${siren}`],
    [isLiv ? "Donneur d'ordre / Expéditeur" : "Propriétaire / Donneur d'ordre", d.donneur_ordre ?? null],
    [isLiv ? "Destinataire / Réceptionnaire" : "Restitué par (utilisateur / locataire)", d.destinataire ?? null],
  ];
  const partH = isLiv ? 21 : 18;
  parties.forEach(([titre, val], i) => {
    const x = M + i * (cw + 5);
    panel(doc, x, y, cw, partH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(...BLUE);
    (doc.splitTextToSize(titre.toUpperCase(), cw - 8) as string[]).slice(0, 2).forEach((l, k) => {
      doc.text(l, x + 4, y + 5.5 + k * 3.4);
    });
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    doc.line(x + 4, y + partH - 8.5, x + cw - 4, y + partH - 8.5);
    doc.line(x + 4, y + partH - 2.5, x + cw - 4, y + partH - 2.5);
    if (val) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.4);
      doc.setTextColor(...TEXT);
      doc.text(doc.splitTextToSize(val, cw - 8)[0] as string, x + 4, y + partH - 3.6);
    }
  });
  y += partH + sp;

  /* ---------- Véhicule ---------- */
  const c3 = (W - 20) / 3;
  const x2 = M + 6 + c3 + 4;
  const x3 = M + 6 + (c3 + 4) * 2;
  const vin = normalizeVin(d.vin);
  const vehH = isLiv ? 28 : 24;
  panel(doc, M, y, W, vehH);
  panelTitle(doc, M + 6, y + 6.5, "Véhicule");
  field(doc, M + 6, y + 13, c3, "Marque / Modèle", d.marque_modele);
  field(doc, x2, y + 13, c3, "Immatriculation", d.immatriculation);
  field(doc, x3, y + 13, c3, "VIN", vin ? formatVin(vin) : null);
  field(doc, M + 6, y + vehH - 7, c3, "N° mission Transports Ligneo", d.numero_mission);
  field(doc, x2, y + vehH - 7, c3, isLiv ? "Kilométrage à la livraison" : "Kilométrage à la restitution", d.kilometrage_arrivee);
  field(doc, x3, y + vehH - 7, c3, "Niveau carburant / batterie", d.carburant);
  y += vehH + sp;

  /* ---------- Comparaison EDL (restitution) ---------- */
  if (!isLiv) {
    const cmpH = 15;
    panel(doc, M, y, W, cmpH);
    panelTitle(doc, M + 6, y + 6.5, "Comparaison avec l'état des lieux de départ");
    field(doc, M + 6, y + 13, c3, "Kilométrage au départ", d.kilometrage_depart);
    field(doc, x2, y + 13, c3, "Kilométrage à la restitution", d.kilometrage_arrivee);
    field(doc, x3, y + 13, c3, "Écart", null);
    y += cmpH + sp;
  }

  /* ---------- Trajet ---------- */
  const trH = isLiv ? 26 : 22;
  const fx1 = M + 6;
  const fx2 = M + W / 2 + 2;
  const fw = W / 2 - 10;
  panel(doc, M, y, W, trH);
  panelTitle(doc, fx1, y + 6.5, isLiv ? "Détails du trajet" : "Détails de la restitution");
  field(doc, fx1, y + 12.5, fw, isLiv ? "Lieu de prise en charge" : "Lieu de mise à disposition initiale", d.lieu_prise_en_charge);
  field(doc, fx2, y + 12.5, fw, isLiv ? "Lieu de livraison" : "Lieu de restitution", d.lieu_livraison);
  field(doc, fx1, y + trH - 6, fw, isLiv ? "Date / heure de prise en charge" : "Date / heure de mise à disposition", d.date_prise_en_charge);
  field(doc, fx2, y + trH - 6, fw, isLiv ? "Date / heure de livraison" : "Date / heure de restitution", d.date_livraison);
  y += trH + sp;

  /* ---------- Conformité ---------- */
  const confH = 10;
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, y, COL2, confH, 2.2, 2.2, "F");
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(XR, y, COL2, confH, 2.2, 2.2, "FD");
  doc.setFillColor(212, 175, 55);
  doc.roundedRect(M + 5, y + 3.3, 3.4, 3.4, 0.5, 0.5, "F");
  checkbox(doc, XR + 5, y + 3.3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.4);
  doc.setTextColor(...WHITE);
  doc.text(isLiv ? "Livraison conforme, sans réserve" : "Restitution conforme, sans réserve", M + 11.5, y + 6.5);
  doc.setTextColor(...INK);
  doc.text(isLiv ? "Livraison avec réserves (voir ci-dessous)" : "Restitution avec réserves (voir ci-dessous)", XR + 11.5, y + 6.5);
  y += confH + sp;

  /* ---------- Réserves ---------- */
  const resH = isLiv ? 26 : 15;
  doc.setFillColor(...CREAM);
  doc.setDrawColor(240, 224, 178);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y, W, resH, 2.2, 2.2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...GOLD);
  doc.text(
    isLiv ? "RÉSERVES CONSTATÉES PAR LE DESTINATAIRE" : "RÉSERVES / DOMMAGES CONSTATÉS À LA RESTITUTION",
    M + 5,
    y + 6,
  );
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(M + 5, y + 8.5, W - 10, resH - 13, 1.6, 1.6, "FD");
  y += resH + sp;

  /* ---------- Schéma + légende ---------- */
  const legW = 60;
  const schW = W - legW - 4;
  const boxGap = 3;
  const ratios = [1, 1.85, 1, 1.85];
  const boxUnit = (schW - 12 - boxGap * 3) / ratios.reduce((a, b) => a + b, 0);
  const boxX = ratios.map((_, i) => M + 6 + ratios.slice(0, i).reduce((a, b) => a + b, 0) * boxUnit + i * boxGap);
  const schH = isLiv ? 42 : 33;
  const boxH = schH - 16;
  panel(doc, M, y, schW, schH);
  panelTitle(doc, M + 6, y + 7, "Schéma des dommages constatés");
  VUES.forEach(([png, label, iw, ih], i) => {
    const boxW = ratios[i]! * boxUnit;
    const bx = boxX[i]!;
    const by = y + 11;
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, by, boxW, boxH, 1.6, 1.6, "FD");
    const maxW = boxW - 3;
    const maxH = boxH - 4;
    const s = Math.min(maxW / iw, maxH / ih);
    doc.addImage(png, "PNG", bx + (boxW - iw * s) / 2, by + (boxH - ih * s) / 2, iw * s, ih * s, undefined, "FAST");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(...MUTED);
    doc.text(label, bx + boxW / 2, by + boxH + 3.6, { align: "center" });
  });

  const legX = M + schW + 4;
  doc.setFillColor(...NAVY);
  doc.roundedRect(legX, y, legW, 8, 2.2, 2.2, "F");
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(legX, y + 6, legW, schH - 6, 2.2, 2.2, "FD");
  doc.setFillColor(...NAVY);
  doc.roundedRect(legX, y, legW, 8, 2.2, 2.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(212, 175, 55);
  doc.text("LÉGENDE", legX + legW / 2, y + 5.4, { align: "center" });
  let ly = y + 13.5;
  const legStep = (schH - 14) / LEGENDE.length;
  LEGENDE.forEach(([code, label]) => {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.circle(legX + 7, ly - 1, 2.1, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    doc.setTextColor(...GOLD);
    doc.text(code, legX + 7, ly + 0.3, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...TEXT);
    doc.text(label, legX + 12, ly + 0.3);
    ly += legStep;
  });
  y += schH + sp;

  /* ---------- Dommages repris de l'EDL ---------- */
  const dommages = (d.dommages ?? []).slice(0, 4);
  if (dommages.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...INK);
    doc.text("DOMMAGES RELEVÉS À L'ÉTAT DES LIEUX DE CETTE MISSION", M, y + 2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT);
    const txt = dommages.map((dm) => [`(${dm.code})`, dm.zone, dm.note].filter(Boolean).join(" ")).join("  ·  ");
    doc.text(doc.splitTextToSize(txt, W)[0] as string, M, y + 5.6);
    y += 8.5;
  }

  /* ---------- Frais additionnels (restitution) ---------- */
  if (!isLiv) {
    const frH = 19;
    panel(doc, M, y, W, frH);
    panelTitle(doc, M + 6, y + 6.5, "Frais additionnels imputables");
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.roundedRect(M + 6, y + 9, COL2 - 6, 8, 2, 2, "FD");
    doc.roundedRect(XR, y + 9, COL2 - 6, 8, 2, 2, "FD");
    checkbox(doc, M + 10, y + 11.4, 3.2);
    checkbox(doc, XR + 4, y + 11.4, 3.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(...INK);
    doc.text("Aucun frais additionnel", M + 16, y + 14.3);
    doc.text("Frais additionnels (détail ci-dessous)", XR + 10, y + 14.3);
    field(doc, M + 6, y + 17, fw, "Nature des frais", null);
    field(doc, fx2, y + 17, fw, "Montant estimé", null);
    y += frH + sp;
  }

  /* ---------- Documents et accessoires ---------- */
  const docsH = isLiv ? 24 : 20;
  panel(doc, M, y, W, docsH);
  panelTitle(doc, M + 6, y + 6.5, isLiv ? "Documents et accessoires remis" : "Documents et accessoires restitués");
  let dy = y + (isLiv ? 12 : 10.5);
  (isLiv ? DOCS_LIVRAISON : DOCS_RESTITUTION).forEach(([l, r]) => {
    checkbox(doc, M + 6, dy - 2.6, 3.2);
    checkbox(doc, XR, dy - 2.6, 3.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...TEXT);
    doc.text(l, M + 12, dy);
    doc.text(r, XR + 6, dy);
    dy += isLiv ? 5.2 : 4.6;
  });
  y += docsH + sp;

  /* ---------- Mention légale ---------- */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  const mention = doc.splitTextToSize(mentionText(isLiv), W - 12) as string[];
  const mentH = mention.length * 3.2 + 6;
  panel(doc, M, y, W, mentH);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  mention.forEach((l, i) => doc.text(l, M + 6, y + 5 + i * 3.2));
  y += mentH + 6;

  /* ---------- Signatures ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Signature du convoyeur", M, y);
  doc.text(isLiv ? "Signature du destinataire" : "Signature du propriétaire / donneur d'ordre", XR, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(
    isLiv
      ? "Certifie la livraison du véhicule dans les conditions décrites ci-dessus"
      : "Certifie la restitution du véhicule dans les conditions décrites ci-dessus",
    M,
    y + 4.6,
  );
  doc.text(
    isLiv
      ? "Certifie la réception du véhicule et l'exactitude des informations ci-dessus"
      : "Certifie la reprise du véhicule et l'exactitude des informations ci-dessus",
    XR,
    y + 4.6,
  );
  const sigY = y + 16;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(M, sigY, M + COL2, sigY);
  doc.line(XR, sigY, XR + COL2, sigY);
  doc.setFontSize(6.6);
  doc.setTextColor(...MUTED);
  doc.text("Nom, date et signature", M, sigY + 3.6);
  doc.text("Nom, date et signature", XR, sigY + 3.6);

  /* ---------- Pied de page ---------- */
  const footY = 283;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(M, footY, right, footY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.setTextColor(...MUTED);
  doc.text(`${c?.raison_sociale || "Transports Ligneo"} · ${ville}`, M, footY + 4.5);
  const site = (c?.site_web || "www.transportsligneo.fr").replace(/^https?:\/\//, "");
  doc.setTextColor(...BLUE);
  doc.text(site, right, footY + 4.5, { align: "right" });
  const siteW = doc.getTextWidth(site);
  doc.setTextColor(...MUTED);
  doc.text(c?.email_contact || "contact@transportsligneo.fr", right - siteW - 4, footY + 4.5, { align: "right" });

  return doc.output("blob");
}
