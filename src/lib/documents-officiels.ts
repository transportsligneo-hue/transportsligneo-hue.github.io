import jsPDF from "jspdf";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { EDL_CAR_SCHEMA_H, EDL_CAR_SCHEMA_PNG, EDL_CAR_SCHEMA_W } from "@/lib/edl-car-schema";
import {
  DOC_CREAM,
  DOC_GOLD,
  DOC_LINE,
  DOC_MUTED,
  DOC_NAVY,
  DOC_TEXT,
  DOC_WHITE,
  dateFmt,
  drawDocHeader,
  docEnsureSpace,
  finalizeDoc,
  drawKeyValueRow,
  drawSectionTitle,
  fetchCompanyInfo,
  loadImageAsDataUrl,
  type CompanyInfo,
} from "@/lib/doc-branding";

async function newDoc(title: string, numero?: string, subtitle?: string, company?: CompanyInfo | null) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const c = company ?? (await fetchCompanyInfo());
  const logo = await loadImageAsDataUrl(logoLigneo);
  drawDocHeader(doc, { pageW, logoData: logo, title, numero, subtitle, company: c });
  return { doc, pageW, pageH, company: c };
}

function signatureBlocks(
  doc: jsPDF,
  pageW: number,
  y: number,
  left: string,
  right: string,
  height = 24,
): number {
  y = docEnsureSpace(doc, y, height + 6);
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.3);
  doc.rect(14, y, (pageW - 32) / 2, height, "S");
  doc.rect(pageW / 2 + 2, y, (pageW - 32) / 2, height, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_NAVY);
  doc.text(left, 18, y + 6);
  doc.text(right, pageW / 2 + 6, y + 6);
  return y;
}

/* ------------------------------------------------------------------ */
/* 04 — FICHE DE MISSION                                               */
/* ------------------------------------------------------------------ */

export interface FicheMissionData {
  numero: string;
  vehicule_marque?: string | null;
  vehicule_modele?: string | null;
  vehicule_type?: string | null;
  immatriculation?: string | null;
  vin?: string | null;
  carburant?: string | null;
  boite?: string | null;
  enlevement_adresse?: string | null;
  enlevement_contact?: string | null;
  enlevement_creneau?: string | null;
  enlevement_instructions?: string | null;
  livraison_adresse?: string | null;
  livraison_contact?: string | null;
  livraison_creneau?: string | null;
  livraison_instructions?: string | null;
  convoyeur_nom?: string | null;
  convoyeur_tel?: string | null;
  notes?: string | null;
}

/** Fiche de mission — mise en page compacte deux colonnes, garantie sur UNE page. */
export async function generateFicheMissionPdf(d: FicheMissionData, company?: CompanyInfo | null): Promise<Blob> {
  const { doc, pageW, pageH, company: c } = await newDoc(
    "Fiche de mission",
    d.numero,
    "À conserver durant toute la durée du convoyage",
    company,
  );
  const w = pageW - 28;
  const colW = (w - 6) / 2;
  const xR = 14 + colW + 6;
  const kv = (x: number, y: number, label: string, value: string) =>
    drawKeyValueRow(doc, x, y, colW, label, value, { labelW: colW * 0.42 });
  let y = 52;

  /* Véhicule */
  y = drawSectionTitle(doc, pageW, y, "Véhicule à convoyer");
  let yl = y;
  let yr = y;
  yl = kv(14, yl, "Marque / modèle", [d.vehicule_marque, d.vehicule_modele, d.vehicule_type].filter(Boolean).join(" ") || "—");
  yl = kv(14, yl, "Immatriculation", d.immatriculation || "—");
  yl = kv(14, yl, "N° de série (VIN)", d.vin || "—");
  yr = kv(xR, yr, "Carburant / boîte", [d.carburant, d.boite].filter(Boolean).join(" — ") || "—");
  yr = kv(xR, yr, "Km au départ", "____________ km");
  yr = kv(xR, yr, "Assistance 24/7", c?.telephone || "—");
  y = Math.max(yl, yr) + 3;

  /* Enlèvement / Livraison côte à côte */
  const ySec = y;
  drawSectionTitle(doc, pageW, ySec, "Enlèvement", { x: 14, w: colW });
  y = drawSectionTitle(doc, pageW, ySec, "Livraison", { x: xR, w: colW });
  yl = y;
  yr = y;
  yl = kv(14, yl, "Adresse", d.enlevement_adresse || "—");
  yl = kv(14, yl, "Contact", d.enlevement_contact || "—");
  yl = kv(14, yl, "Créneau", d.enlevement_creneau || "—");
  yl = kv(14, yl, "Instructions", d.enlevement_instructions || "—");
  yr = kv(xR, yr, "Adresse", d.livraison_adresse || "—");
  yr = kv(xR, yr, "Contact", d.livraison_contact || "—");
  yr = kv(xR, yr, "Créneau", d.livraison_creneau || "—");
  yr = kv(xR, yr, "Instructions", d.livraison_instructions || "—");
  y = Math.max(yl, yr) + 3;

  /* Convoyeur */
  y = drawSectionTitle(doc, pageW, y, "Convoyeur assigné");
  yl = kv(14, y, "Nom et prénom", d.convoyeur_nom || "—");
  yr = kv(xR, y, "Téléphone", d.convoyeur_tel || "—");
  y = Math.max(yl, yr) + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...DOC_NAVY);
  doc.text("DOCUMENTS À EMPORTER PAR LE CONVOYEUR", 14, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DOC_TEXT);
  doc.setFontSize(7);
  doc.text(
    "[  ] Permis de conduire     [  ] Pièce d'identité     [  ] Ordre de mission (ce document)     [  ] Constat amiable     [  ] Attestation RC Pro",
    14,
    y,
  );
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...DOC_NAVY);
  doc.text("NOTES DE MISSION", 14, y);
  y += 2.5;
  doc.setDrawColor(...DOC_LINE);
  doc.rect(14, y, w, 16, "S");
  if (d.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOC_TEXT);
    doc.text(doc.splitTextToSize(d.notes, w - 8).slice(0, 3), 18, y + 5);
  }
  y += 20;

  signatureBlocks(doc, pageW, y, "Signature convoyeur (départ)", "Signature convoyeur (livraison)", 22);
  finalizeDoc(doc, c);
  return doc.output("blob");
}


/* ------------------------------------------------------------------ */
/* 03 — ATTESTATION DE PASSAGE À VIDE                                  */
/* ------------------------------------------------------------------ */

export interface PassageAVideData {
  numero: string;
  convoyeur_nom?: string | null;
  convoyeur_permis?: string | null;
  convoyeur_statut?: string | null;
  convoyeur_siret?: string | null;
  vehicule_type?: string | null;
  vehicule_modele?: string | null;
  vehicule_immat?: string | null;
  motif?: string | null;
  depart?: string | null;
  arrivee?: string | null;
  date_trajet?: string | null;
  heures?: string | null;
  distance_km?: number | null;
  mission_ref?: string | null;
}

export async function generatePassageAVidePdf(d: PassageAVideData, company?: CompanyInfo | null): Promise<Blob> {
  const { doc, pageW, pageH, company: c } = await newDoc(
    "Attestation de passage à vide",
    d.numero,
    "Trajet sans véhicule client transporté",
    company,
  );
  const w = pageW - 28;
  const colW = (w - 6) / 2;
  const xR = 14 + colW + 6;
  const kv = (x: number, y: number, label: string, value: string) =>
    drawKeyValueRow(doc, x, y, colW, label, value, { labelW: colW * 0.44 });
  let y = 52;

  /* Conducteur + véhicule côte à côte */
  const ySec = y;
  drawSectionTitle(doc, pageW, ySec, "Identité du conducteur", { x: 14, w: colW });
  y = drawSectionTitle(doc, pageW, ySec, "Véhicule utilisé", { x: xR, w: colW });
  let yl = y;
  let yr = y;
  yl = kv(14, yl, "Nom et prénom", d.convoyeur_nom || "—");
  yl = kv(14, yl, "N° de permis", d.convoyeur_permis || "—");
  yl = kv(14, yl, "Statut", d.convoyeur_statut || "Convoyeur indépendant");
  yl = kv(14, yl, "N° SIRET", d.convoyeur_siret || "—");
  yr = kv(xR, yr, "Type de véhicule", d.vehicule_type || "—");
  yr = kv(xR, yr, "Marque et modèle", d.vehicule_modele || "—");
  yr = kv(xR, yr, "Immatriculation", d.vehicule_immat || "—");
  yr = kv(xR, yr, "Mission liée", d.mission_ref || "—");
  y = Math.max(yl, yr) + 3;

  /* Détail du trajet */
  y = drawSectionTitle(doc, pageW, y, "Détail du trajet");
  y = drawKeyValueRow(doc, 14, y, w, "Motif du trajet à vide", d.motif || "—");
  yl = kv(14, y, "Lieu de départ", d.depart || "—");
  yl = kv(14, yl, "Date du trajet", dateFmt(d.date_trajet));
  yl = kv(14, yl, "Distance parcourue", d.distance_km ? `${d.distance_km} km` : "—");
  yr = kv(xR, y, "Lieu d'arrivée", d.arrivee || "—");
  yr = kv(xR, yr, "Heures départ / arrivée", d.heures || "—");
  y = Math.max(yl, yr) + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_NAVY);
  doc.text("OBJET DE L'ATTESTATION", 14, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...DOC_TEXT);
  const txt =
    "Ce document atteste que le trajet mentionné ci-dessus a été effectué sans véhicule client à bord, dans le cadre du repositionnement du convoyeur. " +
    "Il est établi à des fins de justification auprès des organismes d'assurance, de contrôle routier ou de tout tiers intéressé, conformément aux pratiques du secteur du convoyage automobile. " +
    (c?.assurance_mention ? `Couverture : ${c.assurance_mention}.` : "");
  const txtLines = doc.splitTextToSize(txt, w);
  y = docEnsureSpace(doc, y, txtLines.length * 3.8 + 5);
  doc.text(txtLines, 14, y);
  y += txtLines.length * 3.8 + 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_MUTED);
  doc.text(`Fait à ${c?.adresse_ville || "—"}, le ${dateFmt(new Date().toISOString())}`, 14, y);
  y += 4;
  signatureBlocks(doc, pageW, y, "Signature du convoyeur", `Pour ${c?.raison_sociale || "Transports Ligneo"}`, 22);


  finalizeDoc(doc, c);
  return doc.output("blob");
}

/* ------------------------------------------------------------------ */
/* 05 — ÉTAT DES LIEUX PAPIER (avec schéma véhicule réaliste)          */
/* ------------------------------------------------------------------ */

/** Silhouette de voiture vue de dessus, dessinée en vectoriel (carrosserie, vitrage, roues). */
export function drawCarTopView(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const r = Math.min(w, h) * 0.22;
  // Carrosserie
  doc.setFillColor(244, 246, 251);
  doc.setDrawColor(...DOC_NAVY);
  doc.setLineWidth(0.7);
  doc.roundedRect(x, y, w, h, r, r, "FD");

  // Roues (4)
  doc.setFillColor(30, 34, 48);
  const wheelW = w * 0.09;
  const wheelH = h * 0.13;
  const wheelInset = -wheelW * 0.35;
  [
    [x + wheelInset, y + h * 0.16],
    [x + w - wheelW - wheelInset, y + h * 0.16],
    [x + wheelInset, y + h * 0.71],
    [x + w - wheelW - wheelInset, y + h * 0.71],
  ].forEach(([wx, wy]) => doc.roundedRect(wx, wy, wheelW, wheelH, 1, 1, "F"));

  // Pare-brise avant (trapèze approché) + lunette arrière
  doc.setFillColor(200, 214, 236);
  doc.setDrawColor(...DOC_NAVY);
  doc.setLineWidth(0.4);
  doc.roundedRect(x + w * 0.18, y + h * 0.13, w * 0.64, h * 0.1, 1.5, 1.5, "FD");
  doc.roundedRect(x + w * 0.18, y + h * 0.77, w * 0.64, h * 0.1, 1.5, 1.5, "FD");

  // Habitacle / toit
  doc.setFillColor(226, 232, 244);
  doc.roundedRect(x + w * 0.14, y + h * 0.25, w * 0.72, h * 0.5, 2.5, 2.5, "FD");
  // Ligne médiane du toit
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.3);
  doc.line(x + w / 2, y + h * 0.27, x + w / 2, y + h * 0.73);
  // Rétroviseurs
  doc.setFillColor(...DOC_NAVY);
  doc.roundedRect(x - w * 0.05, y + h * 0.3, w * 0.06, h * 0.045, 0.6, 0.6, "F");
  doc.roundedRect(x + w * 0.99, y + h * 0.3, w * 0.06, h * 0.045, 0.6, 0.6, "F");
  // Optiques
  doc.setFillColor(...DOC_GOLD);
  doc.roundedRect(x + w * 0.08, y + h * 0.03, w * 0.16, h * 0.035, 0.8, 0.8, "F");
  doc.roundedRect(x + w * 0.76, y + h * 0.03, w * 0.16, h * 0.035, 0.8, 0.8, "F");
  doc.setFillColor(190, 60, 60);
  doc.roundedRect(x + w * 0.08, y + h * 0.94, w * 0.16, h * 0.03, 0.8, 0.8, "F");
  doc.roundedRect(x + w * 0.76, y + h * 0.94, w * 0.16, h * 0.03, 0.8, 0.8, "F");

  // Zones repérables
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_NAVY);
  doc.text("AVANT", x + w / 2, y - 2.5, { align: "center" });
  doc.text("ARRIÈRE", x + w / 2, y + h + 5, { align: "center" });
  doc.text("GAUCHE", x - 6, y + h / 2, { align: "center", angle: 90 });
  doc.text("DROITE", x + w + 6, y + h / 2, { align: "center", angle: 270 });
}

export type EdlPapierVariant = "restitution" | "livraison";

export interface EdlPapierData {
  numero: string;
  variant?: EdlPapierVariant;
  client?: string | null;
  societe?: string | null;
  marque_modele?: string | null;
  immatriculation?: string | null;
  vin?: string | null;
  kilometrage_depart?: string | null;
  kilometrage_arrivee?: string | null;
  carburant?: string | null;
  lieu?: string | null;
  depart?: string | null;
  arrivee?: string | null;
  date_prevue?: string | null;
  convoyeur_nom?: string | null;
}

const EDL_ENERGIES = ["Essence", "Diesel", "Hybride", "Électrique"];

const EDL_EQUIPEMENTS_L = [
  "Clé principale",
  "Clé de secours",
  "Carte grise (copie)",
  "Carnet d'entretien",
  "Triangle de signalisation",
  "Gilet de sécurité",
  "Roue de secours / Kit anticrevaison",
  "Cric",
];
const EDL_EQUIPEMENTS_R = ["Extincteur", "Tapis de sol", "Floquage ou pub sur le véhicule"];

/** Case à cocher vectorielle (cochée si `checked`). */
function drawCheckbox(doc: jsPDF, x: number, y: number, size = 3.2, checked = false) {
  doc.setDrawColor(...DOC_NAVY);
  doc.setLineWidth(0.25);
  doc.setFillColor(...DOC_WHITE);
  doc.rect(x, y, size, size, "FD");
  if (checked) {
    doc.setDrawColor(...DOC_NAVY);
    doc.setLineWidth(0.5);
    doc.line(x + 0.7, y + size / 2, x + size * 0.42, y + size - 0.7);
    doc.line(x + size * 0.42, y + size - 0.7, x + size - 0.6, y + 0.7);
  }
}

/** Ligne « Label : valeur » ou « Label : ______ » à remplir à la main. */
function edlField(doc: jsPDF, x: number, y: number, w: number, label: string, value?: string | null) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_NAVY);
  doc.text(`${label} :`, x, y);
  const lw = doc.getTextWidth(`${label} :`) + 2;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DOC_TEXT);
  const v = (value ?? "").toString().trim();
  if (v) {
    doc.text(doc.splitTextToSize(v, w - lw)[0], x + lw, y);
  } else {
    doc.setDrawColor(...DOC_LINE);
    doc.setLineWidth(0.25);
    doc.line(x + lw, y + 0.8, x + w, y + 0.8);
  }
  return y + 5.4;
}

/**
 * 05 — État des lieux papier (modèles « Restitution » et « Livraison »).
 * Toutes les données véhicule/mission connues sont pré-remplies ; le reste
 * est laissé sous forme de champs à compléter à la main.
 */
export async function generateEdlPapierPdf(d: EdlPapierData, company?: CompanyInfo | null): Promise<Blob> {
  const variant: EdlPapierVariant = d.variant ?? "livraison";
  const isLivraison = variant === "livraison";
  const { doc, pageW, pageH, company: c } = await newDoc(
    "État des lieux",
    d.numero,
    isLivraison ? "Livraison — à l'arrivée du véhicule" : "Restitution — à la sortie du véhicule",
    company,
  );
  const w = pageW - 28;
  let y = 52;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_MUTED);
  doc.text("Ce document est établi contradictoirement entre les parties.", 14, y);
  doc.text(
    isLivraison
      ? "Il décrit l'état du véhicule à la livraison, avant remise au client."
      : "Il décrit l'état du véhicule à la restitution.",
    14,
    y + 3.6,
  );
  y += 9;

  /* 1 — Informations générales */
  y = drawSectionTitle(doc, pageW, y, "1. Informations générales");
  const colW = (w - 8) / 2;
  const xR = 14 + colW + 8;
  let yl = y;
  let yr = y;
  yl = edlField(doc, 14, yl, colW, "Date et heure de l'état des lieux", d.date_prevue ? dateFmt(d.date_prevue) : null);
  yl = edlField(doc, 14, yl, colW, "Société", d.societe || d.client || null);
  yl = edlField(doc, 14, yl, colW, "Lieu", d.lieu || (isLivraison ? d.arrivee : d.depart) || null);
  yl = edlField(doc, 14, yl, colW, "Effectué par (Nom / Prénom)", d.convoyeur_nom || null);
  // Qualité
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_NAVY);
  doc.text("Qualité :", 14, yl);
  let qx = 14 + doc.getTextWidth("Qualité :") + 3;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DOC_TEXT);
  ["Convoyeur", "Réceptionnaire", "Autre"].forEach((q) => {
    drawCheckbox(doc, qx, yl - 3, 3.2, false);
    doc.text(q, qx + 4.4, yl);
    qx += 4.4 + doc.getTextWidth(q) + 5;
  });
  yl += 5.4;

  yr = edlField(doc, xR, yr, colW, "Immatriculation", d.immatriculation);
  yr = edlField(doc, xR, yr, colW, "Marque / Modèle", d.marque_modele);
  yr = edlField(doc, xR, yr, colW, "Kilométrage départ", d.kilometrage_depart ? `${d.kilometrage_depart} km` : null);
  yr = edlField(doc, xR, yr, colW, "Kilométrage arrivée", d.kilometrage_arrivee ? `${d.kilometrage_arrivee} km` : null);
  yr = edlField(doc, xR, yr, colW, "N° de châssis (VIN)", d.vin);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_NAVY);
  doc.text("Carburant / Énergie :", xR, yr);
  let ex = xR + doc.getTextWidth("Carburant / Énergie :") + 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...DOC_TEXT);
  const energie = (d.carburant || "").toLowerCase();
  EDL_ENERGIES.forEach((e) => {
    const checked = energie.length > 0 && e.toLowerCase().startsWith(energie.slice(0, 4));
    drawCheckbox(doc, ex, yr - 3, 3.2, checked);
    doc.text(e, ex + 4.2, yr);
    ex += 4.2 + doc.getTextWidth(e) + 4;
  });
  yr += 5.4;

  y = Math.max(yl, yr) + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_MUTED);
  doc.text(`Trajet : ${d.depart || "—"}  >  ${d.arrivee || "—"}`, 14, y);
  y += 5;

  /* 2 — État extérieur */
  y = drawSectionTitle(doc, pageW, y, "2. État extérieur du véhicule") - 1;
  const schemaTop = y + 3;
  // Schéma véhicule officiel (5 vues) — identique au gabarit papier de référence
  const schemaW = 104;
  const schemaH = (schemaW * EDL_CAR_SCHEMA_H) / EDL_CAR_SCHEMA_W;
  doc.addImage(EDL_CAR_SCHEMA_PNG, "PNG", 18, schemaTop + 1, schemaW, schemaH, undefined, "FAST");


  // Légende (encadré à droite, comme le gabarit)
  const legendX = 140;
  const legendW = pageW - 14 - legendX;
  const legendH = schemaH + 4;
  doc.setDrawColor(...DOC_NAVY);
  doc.setLineWidth(0.4);
  doc.rect(legendX, schemaTop, legendW, legendH, "S");
  const lx = legendX + 5;
  let ly = schemaTop + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...DOC_NAVY);
  doc.text("LÉGENDE", legendX + legendW / 2, ly, { align: "center" });
  ly += 5.4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_TEXT);
  [
    "(R)  Rayure",
    "(C)  Coup",
    "(E)  Enfoncement",
    "(M)  Manquant / Cassé",
    "(T)  Tache",
    "( • )  Impact (gravillon)",
  ].forEach((t) => {
    doc.text(t, lx, ly);
    ly += 4.6;
  });

  y = schemaTop + legendH + 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...DOC_NAVY);
  doc.text("Commentaires extérieurs :", 14, y);
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.25);
  doc.line(14, y + 4.5, pageW - 14, y + 4.5);
  y += 7;

  /* 3 — Équipements */
  y = drawSectionTitle(doc, pageW, y, "3. État des équipements et accessoires") - 1;
  const colEq = (w - 8) / 2;
  const headerCols = (x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...DOC_MUTED);
    ["OK", "NOK", "N/A"].forEach((lbl, i) => {
      doc.text(lbl, x + colEq - 24 + i * 9, yy, { align: "center" });
    });
  };
  headerCols(14, y + 1);
  headerCols(xR, y + 1);

  const rowEq = (x: number, yy: number, label: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOC_TEXT);
    doc.text(doc.splitTextToSize(label, colEq - 32)[0], x, yy);
    for (let i = 0; i < 3; i++) drawCheckbox(doc, x + colEq - 25.6 + i * 9, yy - 2.8, 3.2, false);
    doc.setDrawColor(...DOC_LINE);
    doc.setLineWidth(0.15);
    doc.line(x, yy + 1.8, x + colEq, yy + 1.8);
    return yy + 4.05;
  };
  let ye1 = y + 6;
  EDL_EQUIPEMENTS_L.forEach((l) => { ye1 = rowEq(14, ye1, l); });
  let ye2 = y + 6;
  EDL_EQUIPEMENTS_R.forEach((l) => { ye2 = rowEq(xR, ye2, l); });
  y = Math.max(ye1, ye2) + 1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...DOC_NAVY);
  doc.text("Commentaires intérieurs / équipements :", 14, y);
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.25);
  doc.line(14, y + 4.5, pageW - 14, y + 4.5);
  y += 5.5;

  /* 4 — Observations */
  y = drawSectionTitle(doc, pageW, y, "4. Observations complémentaires") - 2;
  doc.setDrawColor(...DOC_LINE);
  doc.setLineWidth(0.25);
  for (let i = 0; i < 2; i++) doc.line(14, y + 3 + i * 4.4, pageW - 14, y + 3 + i * 4.4);
  y += 8;



  /* Signatures */
  const sigH = 21;
  const sigY = signatureBlocks(doc, pageW, y, "LE CONVOYEUR / PARC LIVREUR", "LE CLIENT / REPRÉSENTANT", sigH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DOC_TEXT);
  doc.text(`Nom : ${d.convoyeur_nom || "..............................."}`, 18, sigY + 10);
  doc.text(`Nom : ${d.client || "..............................."}`, pageW / 2 + 6, sigY + 10);
  doc.text("Signature :", 18, sigY + 16);
  doc.text("Signature :", pageW / 2 + 6, sigY + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...DOC_GOLD);
  doc.text("BON POUR ACCORD", pageW / 2, sigY + sigH + 3.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(...DOC_MUTED);
  doc.text(
    "Le véhicule est pris en charge en l'état, conformément aux observations ci-dessus.",
    pageW / 2,
    sigY + sigH + 7,
    { align: "center" },
  );

  finalizeDoc(doc, c);
  return doc.output("blob");
}


/* ------------------------------------------------------------------ */
/* 06 — CONTRAT DE PARTENARIAT CONVOYEUR                               */
/* ------------------------------------------------------------------ */

export interface ContratConvoyeurData {
  nom_complet: string;
  siret?: string | null;
  adresse?: string | null;
  permis_numero?: string | null;
  permis_date?: string | null;
  signature_nom?: string | null;
  signed_at?: string | null;
  signature_ip?: string | null;
}

export interface ContratArticle {
  titre: string;
  paragraphes: string[];
  puces?: string[];
}

export function buildContratArticles(c?: CompanyInfo | null): ContratArticle[] {
  const societe = c?.raison_sociale || "Transports Ligneo";
  return [
    {
      titre: "Article 1 — Objet du contrat",
      paragraphes: [
        `Le présent contrat a pour objet de définir les conditions dans lesquelles le Convoyeur, prestataire indépendant, réalise pour le compte de ${societe} des missions de convoyage de véhicules automobiles (transfert, livraison, restitution) au bénéfice des clients de la Société.`,
        "Le présent contrat ne constitue en aucun cas un contrat de travail. Le Convoyeur exerce son activité en toute indépendance, sans lien de subordination juridique avec la Société.",
      ],
    },
    {
      titre: "Article 2 — Conditions préalables et éligibilité",
      paragraphes: ["Le Convoyeur déclare et garantit remplir, à la date de signature et pendant toute la durée du contrat, les conditions suivantes :"],
      puces: [
        "Être titulaire d'un permis de conduire catégorie B valide depuis au moins 3 ans ;",
        "Être âgé d'au moins 21 ans ;",
        "Présenter un casier judiciaire (bulletin n°3) vierge de toute mention incompatible avec l'activité de convoyage ;",
        "Disposer d'un statut juridique en règle, avec un numéro SIRET actif ;",
        "Souscrire et maintenir une assurance responsabilité civile professionnelle couvrant le convoyage automobile ;",
        "Ne faire l'objet d'aucune suspension ou annulation de permis de conduire en cours.",
      ],
    },
    {
      titre: "Article 3 — Modalités d'attribution des missions",
      paragraphes: [
        "Les missions sont proposées au Convoyeur via l'application « Espace Driver », selon ses disponibilités déclarées et sa zone géographique.",
        "Le Convoyeur demeure libre d'accepter ou de refuser toute mission, sans justification et sans sanction. Une fois la mission acceptée, il s'engage à l'exécuter personnellement selon les modalités convenues.",
      ],
    },
    {
      titre: "Article 4 — Obligations du convoyeur",
      paragraphes: ["Dans l'exécution de chaque mission, le Convoyeur s'engage à :"],
      puces: [
        "Se présenter aux lieux et horaires convenus avec le client ;",
        "Réaliser un état des lieux contradictoire au départ et à l'arrivée, avec photos horodatées ;",
        "Conduire le véhicule confié avec prudence, dans le respect du Code de la route ;",
        "Ne transporter aucun passager ni marchandise non autorisés ;",
        "Signaler sans délai tout incident, accident, panne ou anomalie via la fonction de signalement ;",
        "Restituer le véhicule dans l'état constaté au départ, hors usure normale ;",
        "Respecter la confidentialité des informations clients.",
      ],
    },
    {
      titre: "Article 5 — Obligations de la société",
      paragraphes: ["La Société s'engage à :"],
      puces: [
        "Transmettre toutes les informations utiles à l'exécution de la mission (fiche de mission, contacts, instructions) ;",
        "Régler la rémunération convenue dans les délais fixés à l'Article 6 ;",
        "Mettre à disposition une assistance téléphonique 24h/24 et 7j/7 en cas d'incident ;",
        "Maintenir une couverture d'assurance complémentaire pour les véhicules convoyés.",
      ],
    },
    {
      titre: "Article 6 — Rémunération et facturation",
      paragraphes: [
        "Chaque mission fait l'objet d'une rémunération forfaitaire communiquée avant acceptation, calculée selon la distance, le type de véhicule et les contraintes horaires.",
        "Le Convoyeur émet une facture pour chaque mission ou selon une périodicité convenue. Le règlement intervient par virement bancaire sous 30 jours à compter de la réception de la facture. Les frais annexes engagés dans le cadre strict d'une mission sont pris en charge selon les modalités de la fiche de mission.",
      ],
    },
    {
      titre: "Article 7 — Assurances et responsabilité",
      paragraphes: [
        "Le Convoyeur demeure seul responsable de tout dommage causé de son fait personnel durant l'exécution d'une mission, sous réserve des garanties de son assurance RC Pro convoyage.",
        "En cas de sinistre, il s'engage à établir un constat contradictoire lorsque cela est possible, à alerter immédiatement l'assistance et à transmettre les documents nécessaires au traitement du dossier.",
      ],
    },
    {
      titre: "Article 8 — Durée, suspension et résiliation",
      paragraphes: [
        "Le contrat est conclu pour une durée indéterminée à compter de sa signature. Chaque Partie peut le résilier à tout moment moyennant un préavis écrit de 15 jours calendaires.",
        "La Société peut suspendre immédiatement l'accès aux missions en cas de manquement grave aux obligations de l'Article 4, de suspension du permis, d'expiration de l'assurance RC Pro, de comportement dangereux ou de signalements clients répétés et documentés.",
      ],
    },
    {
      titre: "Article 9 — Indépendance et absence de lien de subordination",
      paragraphes: [
        "Le Convoyeur exerce son activité en toute autonomie : il détermine librement son organisation de travail et ses horaires de disponibilité. Il ne bénéficie d'aucune exclusivité et demeure libre de travailler pour d'autres donneurs d'ordre, sous réserve de l'Article 10.",
      ],
    },
    {
      titre: "Article 10 — Confidentialité et protection des données",
      paragraphes: [
        "Le Convoyeur s'engage à conserver strictement confidentielles les informations relatives aux clients de la Société.",
        "Les données personnelles du Convoyeur sont traitées conformément au RGPD, aux seules fins de gestion de la relation contractuelle. Il dispose d'un droit d'accès, de rectification et de suppression.",
      ],
    },
    {
      titre: "Article 11 — Propriété intellectuelle",
      paragraphes: [
        `Le Convoyeur s'interdit toute utilisation non autorisée de la marque, du nom commercial ou du logo de ${societe}, en dehors du cadre strict de l'exécution de ses missions.`,
      ],
    },
    {
      titre: "Article 12 — Droit applicable et litiges",
      paragraphes: [
        "Le présent contrat est soumis au droit français. À défaut d'accord amiable dans un délai de 30 jours, tout litige sera porté devant les juridictions compétentes du ressort du siège social de la Société.",
      ],
    },
    {
      titre: "Article 13 — Dispositions finales",
      paragraphes: [
        "Le présent contrat constitue l'intégralité de l'accord entre les Parties et annule tout accord antérieur portant sur le même objet. Toute modification devra faire l'objet d'un avenant écrit signé par les deux Parties.",
      ],
    },
  ];
}

export function buildContratPreambule(d: ContratConvoyeurData, c?: CompanyInfo | null): string[] {
  const adresse = [c?.adresse_ligne1, [c?.adresse_cp, c?.adresse_ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [
    `${c?.raison_sociale || "Transports Ligneo"}, ${c?.forme_juridique || ""}${c?.capital_social ? ` au capital de ${c.capital_social}` : ""}${c?.rcs ? `, immatriculée au RCS de ${c.rcs}` : ""}${adresse ? `, dont le siège social est situé ${adresse}` : ""}${c?.signataire_nom ? `, représentée par ${c.signataire_nom}, agissant en qualité de ${c.signataire_fonction || "représentant légal"}` : ""}. Ci-après désignée « la Société ».`,
    `${d.nom_complet}, entrepreneur individuel / auto-entrepreneur, immatriculé sous le numéro SIRET ${d.siret || "—"}, domicilié à ${d.adresse || "—"}, titulaire du permis de conduire catégorie B n° ${d.permis_numero || "—"}${d.permis_date ? ` délivré le ${dateFmt(d.permis_date)}` : ""}. Ci-après désigné « le Convoyeur ».`,
  ];
}

/** Nombre de pages du dernier contrat généré (utile pour placer le champ de signature). */
let lastContratPageCount = 1;
export function getLastContratPageCount() {
  return lastContratPageCount;
}

export async function generateContratConvoyeurPdf(
  d: ContratConvoyeurData,
  company?: CompanyInfo | null,
): Promise<Blob> {
  const { doc, pageW, pageH, company: c } = await newDoc(
    "Contrat de partenariat",
    undefined,
    "Convoyeur indépendant",
    company,
  );
  const w = pageW - 28;
  let y = 56;

  const ensure = (need: number) => {
    if (y + need > pageH - 26) {
      doc.addPage();
      drawDocHeader(doc, { pageW, title: "Contrat de partenariat", subtitle: "Convoyeur indépendant", company: c, height: 26 });
      y = 36;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DOC_NAVY);
  doc.text("ENTRE LES SOUSSIGNÉS :", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_TEXT);
  buildContratPreambule(d, c).forEach((p) => {
    const lines = doc.splitTextToSize(p, w);
    ensure(lines.length * 4 + 6);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 5;
  });

  buildContratArticles(c).forEach((a) => {
    ensure(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...DOC_NAVY);
    doc.text(a.titre.toUpperCase(), 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DOC_TEXT);
    a.paragraphes.forEach((p) => {
      const lines = doc.splitTextToSize(p, w);
      ensure(lines.length * 4 + 3);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 2;
    });
    (a.puces ?? []).forEach((b) => {
      const lines = doc.splitTextToSize(b, w - 6);
      ensure(lines.length * 4 + 2);
      doc.setTextColor(...DOC_GOLD);
      doc.text("•", 16, y);
      doc.setTextColor(...DOC_TEXT);
      doc.text(lines, 20, y);
      y += lines.length * 4 + 1;
    });
    y += 3;
  });

  ensure(46);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_MUTED);
  doc.text(
    `Fait à ${c?.adresse_ville || "—"}, le ${dateFmt(d.signed_at || new Date().toISOString())}.`,
    14,
    y,
  );
  y += 5;

  doc.setFillColor(...DOC_CREAM);
  doc.setDrawColor(...DOC_LINE);
  doc.rect(14, y, w, 32, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_NAVY);
  doc.text(`Pour ${c?.raison_sociale || "Transports Ligneo"}`, 18, y + 6);
  doc.text("Le Convoyeur", pageW / 2 + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DOC_TEXT);
  doc.setFontSize(7.5);
  doc.text(`${c?.signataire_nom || "—"} — ${c?.signataire_fonction || "—"}`, 18, y + 12);
  doc.text(d.nom_complet, pageW / 2 + 4, y + 12);

  if (d.signed_at) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DOC_NAVY);
    doc.text("Signé électroniquement — lu et approuvé", pageW / 2 + 4, y + 19);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DOC_MUTED);
    doc.setFontSize(6.8);
    doc.text(`Nom saisi : ${d.signature_nom || d.nom_complet}`, pageW / 2 + 4, y + 24);
    doc.text(
      `Horodatage : ${new Date(d.signed_at).toLocaleString("fr-FR")}${d.signature_ip ? ` — IP ${d.signature_ip}` : ""}`,
      pageW / 2 + 4,
      y + 28,
    );
  } else {
    doc.setTextColor(...DOC_MUTED);
    doc.setFontSize(7);
    doc.text("Signature précédée de la mention « Lu et approuvé »", pageW / 2 + 4, y + 24);
  }

  finalizeDoc(doc, c);
  lastContratPageCount = doc.getNumberOfPages();
  return doc.output("blob");
}

/* ------------------------------------------------------------------ */
/* 07 — CHARTE DE PRÉSENTATION ET DE DISCRÉTION                        */
/* ------------------------------------------------------------------ */

export interface CharteArticle {
  titre: string;
  paragraphes: string[];
  puces?: string[];
}

export function buildCharteArticles(c?: CompanyInfo | null): CharteArticle[] {
  const societe = c?.raison_sociale || "Transports Ligneo";
  return [
    {
      titre: "Préambule",
      paragraphes: [
        `La présente charte définit les règles de présentation, de comportement et de discrétion que tout convoyeur du réseau ${societe} s'engage à respecter dans l'exercice de son activité. Elle complète le contrat de partenariat convoyeur et en constitue une annexe à part entière.`,
        "Le respect de cette charte conditionne le maintien de l'accès aux missions proposées par la Société. Chaque véhicule convoyé appartient à un client qui place sa confiance dans le réseau Ligneo : cette charte a pour objet de garantir que cette confiance est honorée à chaque mission.",
      ],
    },
    {
      titre: "Article 1 — Présentation et tenue",
      paragraphes: [
        `Le Convoyeur s'engage à se présenter à chaque mission dans une tenue propre, sobre et professionnelle, cohérente avec l'image de la Société. Le port d'éléments d'identification ${societe}, lorsqu'ils sont fournis par la Société, est obligatoire durant l'exécution des missions.`,
      ],
      puces: [
        "Tenue propre, sans signe distinctif d'une autre marque ou société concurrente ;",
        "Hygiène et présentation soignées ;",
        "Comportement courtois et respectueux envers le client, ses représentants, et toute personne rencontrée dans le cadre de la mission ;",
        "Ponctualité aux horaires convenus, avec information immédiate du client et de la Société en cas de retard prévisible.",
      ],
    },
    {
      titre: "Article 2 — Attitude et comportement professionnel",
      paragraphes: ["Le Convoyeur représente la Société à chaque mission. À ce titre, il s'engage à :"],
      puces: [
        "Adopter une conduite calme, prudente et respectueuse du Code de la route en toutes circonstances, y compris hors mission ;",
        "Ne jamais utiliser le véhicule confié à des fins personnelles, ni effectuer de détour non justifié par la mission ;",
        "Ne fumer, ni consommer d'alcool ou toute autre substance, à bord du véhicule confié ;",
        "Ne transporter aucun passager ni objet personnel non autorisé durant la mission ;",
        "Signaler immédiatement à la Société toute situation exceptionnelle rencontrée durant la mission.",
      ],
    },
    {
      titre: "Article 3 — Discrétion et confidentialité",
      paragraphes: [
        "Le Convoyeur a accès, dans le cadre de ses missions, à des informations sensibles concernant les clients de la Société : identité, coordonnées, adresses de domicile ou d'entreprise, habitudes, et parfois informations visibles à l'intérieur du véhicule. Le Convoyeur s'engage à une discrétion absolue concernant ces informations.",
      ],
      puces: [
        "Ne jamais divulguer à un tiers l'identité, l'adresse ou toute information relative à un client, sauf nécessité liée à l'exécution de la mission et auprès des seules personnes habilitées de la Société ;",
        "Ne prendre aucune photo ou vidéo du véhicule, de son contenu, de la plaque d'immatriculation ou des lieux d'intervention à d'autres fins que celles strictement nécessaires à l'état des lieux contradictoire ;",
        "Ne jamais publier sur les réseaux sociaux ou tout support public une photo, vidéo, ou mention identifiant un client, un véhicule confié, une adresse de mission, sans autorisation écrite préalable de la Société et du client concerné ;",
        "Ne consulter, utiliser ou conserver aucune information ou objet trouvé à bord du véhicule en dehors du strict cadre de la mission ;",
        "Conserver la confidentialité des conditions tarifaires, méthodes internes et outils de la Société vis-à-vis de tout tiers, y compris d'autres convoyeurs extérieurs au réseau.",
      ],
    },
    {
      titre: "Article 4 — Respect des biens confiés",
      paragraphes: [
        "Le Convoyeur s'engage à traiter chaque véhicule confié avec le même soin que s'il s'agissait de son propre bien : conduite adaptée, respect de tous les réglages et objets présents dans le véhicule, restitution dans l'état constaté au départ hors usure normale liée au trajet.",
        "Cette obligation de discrétion perdure au-delà de la fin de la mission concernée et de la relation contractuelle avec la Société.",
      ],
    },
    {
      titre: "Article 5 — Manquement à la charte",
      paragraphes: [
        "Tout manquement avéré à la présente charte pourra entraîner, selon sa gravité, un avertissement, une suspension temporaire de l'accès aux missions, ou une résiliation du contrat de partenariat, conformément aux dispositions prévues à ce titre dans le contrat de partenariat convoyeur.",
        "Un manquement grave à l'obligation de discrétion (divulgation d'informations client, publication non autorisée) est considéré comme une faute grave pouvant justifier une suspension immédiate, sans préavis.",
      ],
    },
  ];
}

let lastChartePageCount = 1;
export function getLastChartePageCount() {
  return lastChartePageCount;
}

/** Charte de présentation et de discrétion — annexe au contrat de partenariat. */
export async function generateCharteDiscretionPdf(
  d: ContratConvoyeurData,
  company?: CompanyInfo | null,
): Promise<Blob> {
  const { doc, pageW, pageH, company: c } = await newDoc(
    "Charte de présentation et de discrétion",
    undefined,
    "Annexe au contrat de partenariat convoyeur",
    company,
  );
  const w = pageW - 28;
  let y = 56;

  const ensure = (need: number) => {
    if (y + need > pageH - 26) {
      doc.addPage();
      drawDocHeader(doc, {
        pageW,
        title: "Charte de présentation et de discrétion",
        subtitle: "Annexe au contrat de partenariat convoyeur",
        company: c,
        height: 26,
      });
      y = 36;
    }
  };

  buildCharteArticles(c).forEach((a) => {
    ensure(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...DOC_NAVY);
    doc.text(a.titre.toUpperCase(), 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DOC_TEXT);
    a.paragraphes.forEach((p) => {
      const lines = doc.splitTextToSize(p, w);
      ensure(lines.length * 4 + 3);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 2;
    });
    (a.puces ?? []).forEach((b) => {
      const lines = doc.splitTextToSize(b, w - 6);
      ensure(lines.length * 4 + 2);
      doc.setTextColor(...DOC_GOLD);
      doc.text("•", 16, y);
      doc.setTextColor(...DOC_TEXT);
      doc.text(lines, 20, y);
      y += lines.length * 4 + 1;
    });
    y += 3;
  });

  ensure(52);
  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_TEXT);
  const engagement = doc.splitTextToSize(
    `Je soussigné(e), ${d.nom_complet}, reconnais avoir pris connaissance de la présente charte et m'engage à en respecter l'intégralité des dispositions dans le cadre de mon activité de convoyeur partenaire ${c?.raison_sociale || "Transports Ligneo"}.`,
    w,
  );
  doc.text(engagement, 14, y);
  y += engagement.length * 4 + 5;

  doc.setTextColor(...DOC_MUTED);
  doc.text(
    `Fait à ${c?.adresse_ville || "Tours"}, le ${dateFmt(d.signed_at || new Date().toISOString())}, en deux exemplaires originaux.`,
    14,
    y,
  );
  y += 5;

  doc.setFillColor(...DOC_CREAM);
  doc.setDrawColor(...DOC_LINE);
  doc.rect(14, y, w, 32, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DOC_NAVY);
  doc.text(`Pour ${c?.raison_sociale || "Transports Ligneo"}`, 18, y + 6);
  doc.text("Le Convoyeur", pageW / 2 + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DOC_TEXT);
  doc.setFontSize(7.5);
  doc.text(`${c?.signataire_nom || "—"} — ${c?.signataire_fonction || "—"}`, 18, y + 12);
  doc.text(d.nom_complet, pageW / 2 + 4, y + 12);
  doc.setTextColor(...DOC_MUTED);
  doc.setFontSize(7);
  doc.text("Signature précédée de la mention « Lu et approuvé »", 18, y + 24);
  doc.text("Signature précédée de la mention « Lu et approuvé »", pageW / 2 + 4, y + 24);

  finalizeDoc(doc, c);
  lastChartePageCount = doc.getNumberOfPages();
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Couleurs réexportées pour les consommateurs. */
export { DOC_WHITE };
