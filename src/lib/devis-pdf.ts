import jsPDF from "jspdf";
// Logo officiel carré 1:1 — évite l'écrasement subi par logo-ligneo.png (ratio 2.65)
import { LIGNEO_BRAND_LOGO as logoLigneo } from "@/lib/brand-assets";
import signatureGo from "@/assets/signature-go.png";
import {
  fetchCompanyInfo,
  companyLegalLine1,
  companyLegalLine2,
  resolveClientBillingIdentity,
  toSiren,

  type CompanyInfo,
} from "@/lib/doc-branding";
import { applyLigneoFonts } from "@/lib/pdf-fonts";
import { fetchActiveRegime } from "@/lib/pricing/fetch";
import { drawPlateTag } from "@/lib/pdf-plate";


export interface DevisData {
  numero: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string | null;
  adresse?: string | null;
  /** Optional client company info shown in the "DEVIS ÉTABLI POUR" block. */
  societe?: string | null;
  siret?: string | null;
  tva_intra?: string | null;
  /** Optional public URL of the client company logo. */
  logo_url?: string | null;
  depart: string;
  arrivee: string;
  distance_km?: number | null;
  duree_estimee?: string | null;
  type_vehicule?: string | null;
  marque?: string | null;
  modele?: string | null;
  carburant?: string | null;
  prestation?: string | null;
  option_trajet?: string | null;
  /** Immatriculation du vehicule convoye */
  immatriculation?: string | null;
  /** Numéro de série (VIN) du véhicule convoyé */
  vin?: string | null;
  /** Aller-retour : vehicule restitue (souvent une autre plaque) */
  marque_retour?: string | null;
  modele_retour?: string | null;
  immatriculation_retour?: string | null;
  vin_retour?: string | null;
  /** Devis groupé : plusieurs véhicules sur un même devis */
  vehicules?: Array<{
    immatriculation?: string | null;
    marque?: string | null;
    modele?: string | null;
    vin?: string | null;
    arrivee?: string | null;
    prix?: number | null;
  }> | null;

  /** Options additionnelles cochees (recharge, lavage, mise en main...) */
  options?: string[] | null;
  /** Transport sur plateau porte-voiture (vehicule non roulant) */
  plateau?: boolean | null;
  /** Suppléments facturés en lignes distinctes (assurance, péages, dossier...) */
  supplements?: Array<{ label: string; montant: number }> | null;
  /** PV de livraison digitalise (WelcomeAuto / Model) */
  pv_digital?: string | null;
  /** Destinataire / client livre */
  destinataire_nom?: string | null;
  destinataire_tel?: string | null;
  destinataire_note?: string | null;

  date_souhaitee?: string | null;
  heure_souhaitee?: string | null;
  prix_estime: number;
  tarif_label?: string | null;
  multiplier_label?: string | null;
  message?: string | null;
  mode_paiement?: string | null;
  validite_jours?: number;
  created_at?: string;
  /** Version du devis (1 par défaut) — affichée si > 1 */
  version?: number | null;
  /** Signature manuscrite du client (data URL PNG) — bloc "Bon pour accord" */
  clientSignatureDataUrl?: string | null;
  /** Libellé de la date d'acceptation, ex "11/06/2026 à 14:32" */
  acceptedAtLabel?: string | null;
  /** Preuve de signature électronique par code OTP e-mail (cartouche dédié) */
  otpProof?: {
    email: string;
    method: string;
    acceptedAtLabel: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    cgvVersion?: string | null;
    pdfHash?: string | null;
  } | null;
}

/**
 * Relit les options cochées (plein carburant, recharge élec, mise en main, lavage…)
 * et le PV digitalisé depuis le récapitulatif enregistré dans `message`.
 */
export function parseDevisOptions(message?: string | null): { options: string[]; pv: string | null } {
  const out: { options: string[]; pv: string | null } = { options: [], pv: null };
  if (!message) return out;
  for (const raw of message.split("\n")) {
    const line = raw.trim();
    const optMatch = line.match(/^Options?\s*:\s*(.+)$/i);
    if (optMatch) {
      out.options = optMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    const pvMatch = line.match(/^PV de livraison digitalis[ée]\s*:\s*(.+)$/i);
    if (pvMatch) out.pv = pvMatch[1].trim();
  }
  return out;
}

/**
 * Relit le mode « transport sur plateau » et les suppléments facturés
 * (assurance, péages, chargement…) depuis le récapitulatif `message`.
 */
export function parseDevisSupplements(message?: string | null): {
  plateau: boolean;
  supplements: Array<{ label: string; montant: number }>;
} {
  const out = { plateau: false, supplements: [] as Array<{ label: string; montant: number }> };
  if (!message) return out;
  for (const raw of message.split("\n")) {
    const line = raw.trim();
    if (/^Transport sur plateau\s*:/i.test(line)) {
      out.plateau = /oui/i.test(line);
      continue;
    }
    const m = line.match(/^Suppl[ée]ment\s*:\s*(.+?)\s*=\s*([\d.,\s]+)\s*€/i);
    if (m) {
      const montant = parseFloat(m[2].replace(/\s/g, "").replace(",", "."));
      if (Number.isFinite(montant)) out.supplements.push({ label: m[1].trim(), montant });
    }
  }
  return out;
}



/** Détecte un devis « recharge uniquement, sans livraison ». */
export function isDevisRechargeSeule(d: { option_trajet?: string | null; prestation?: string | null }): boolean {
  const t = `${d.option_trajet ?? ""} ${d.prestation ?? ""}`.toLowerCase();
  return t.includes("recharge") && (t.includes("sans livraison") || t.includes("uniquement"));
}

/**
 * Mappe une ligne brute de la table `devis` (select *) vers les données du PDF.
 * Point d'entrée unique : garantit que les devis groupés (colonne `vehicules`)
 * sont toujours détaillés véhicule par véhicule, quel que soit l'écran appelant.
 */
export function devisRowToPdfData(
  row: Record<string, unknown>,
  extra: Partial<DevisData> = {},
): DevisData {
  const g = <T,>(k: string) => row[k] as T;
  const rawVeh = row["vehicules"];
  const vehicules = Array.isArray(rawVeh)
    ? (rawVeh as DevisData["vehicules"])
    : null;
  return {
    numero: g<string>("numero"),
    nom: g<string>("nom"),
    prenom: g<string>("prenom"),
    email: g<string>("email"),
    telephone: g<string | null>("telephone"),
    depart: g<string>("depart"),
    arrivee: g<string>("arrivee"),
    distance_km: g<number | null>("distance_km"),
    duree_estimee: g<string | null>("duree_estimee"),
    type_vehicule: g<string | null>("type_vehicule"),
    marque: g<string | null>("marque"),
    modele: g<string | null>("modele"),
    immatriculation: g<string | null>("immatriculation"),
    vin: g<string | null>("vin"),
    marque_retour: g<string | null>("marque_retour"),
    modele_retour: g<string | null>("modele_retour"),
    immatriculation_retour: g<string | null>("immatriculation_retour"),
    vin_retour: g<string | null>("vin_retour"),
    vehicules,
    carburant: g<string | null>("carburant"),
    prestation: g<string | null>("prestation"),
    option_trajet: g<string | null>("option_trajet"),
    date_souhaitee: g<string | null>("date_souhaitee"),
    heure_souhaitee: g<string | null>("heure_souhaitee"),
    destinataire_nom: g<string | null>("contact_arrivee_nom"),
    destinataire_tel: g<string | null>("contact_arrivee_tel"),
    destinataire_note: g<string | null>("contact_arrivee_note"),
    prix_estime: Number(g<number>("prix_estime")),
    tarif_label: g<string | null>("tarif_label"),
    multiplier_label: g<string | null>("multiplier_label"),
    message: g<string | null>("message"),
    created_at: g<string | undefined>("created_at"),
    version: (g<number | null>("version")) ?? 1,
    ...extra,
  };
}

/* ===== Palette du gabarit "devis clair" (identique à la maquette) ===== */
const INK: [number, number, number] = [15, 23, 42]; // titres quasi noirs
const BLUE: [number, number, number] = [47, 95, 255]; // bleu électrique
const MUTED: [number, number, number] = [113, 122, 140];
const FAINT: [number, number, number] = [148, 157, 173];
const LINE: [number, number, number] = [228, 231, 238];
const CARD: [number, number, number] = [244, 245, 249];
const WHITE: [number, number, number] = [255, 255, 255];
const BLUE_SOFT: [number, number, number] = [232, 238, 255];
const AMBER_SOFT: [number, number, number] = [255, 243, 219];
const AMBER_INK: [number, number, number] = [161, 108, 12];
const PINK_SOFT: [number, number, number] = [255, 233, 240];
const PINK_INK: [number, number, number] = [200, 42, 90];
const GREEN_SOFT: [number, number, number] = [225, 247, 235];
const GREEN_INK: [number, number, number] = [22, 128, 82];

const M = 14; // marge du gabarit

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

const eur = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} €`;

/** Plaque au format administratif AA-123-AA (comme dans Missions / Attributions). */
export function formatPlate(v?: string | null): string | null {
  const raw = (v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw) return null;
  const m = raw.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return (v ?? "").toUpperCase().trim();
}

/**
 * Kilométrage du devis : valeur enregistrée, sinon table des distances villes,
 * sinon géocodage + distance routière estimée. Le devis doit TOUJOURS afficher un km.
 */
async function resolveDistanceKm(d: DevisData): Promise<number | null> {
  if (d.distance_km && Number(d.distance_km) > 0) return Math.round(Number(d.distance_km));
  const from = (d.depart ?? "").trim();
  const to = (d.arrivee ?? "").trim();
  if (!from || !to) return null;
  if (from.toLowerCase() === to.toLowerCase()) return 0;
  try {
    const { getDistance } = await import("@/lib/reservation-pricing");
    const local = getDistance(from, to);
    if (local != null && local > 0) return Math.round(local);
  } catch { /* table indisponible */ }
  try {
    const { geocodeAddress, haversineKm } = await import("@/lib/geocode");
    const [a, b] = await Promise.all([geocodeAddress(from), geocodeAddress(to)]);
    if (a && b) {
      const km = haversineKm(a, b) * 1.22; // facteur routier
      if (km > 0) return Math.round(km);
    }
  } catch { /* réseau indisponible */ }
  return null;
}

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch { return d; }
};

const addDays = (iso: string | undefined, days: number) => {
  const base = iso ? new Date(iso) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
};


/** Pastille arrondie type "badge" (ENLÈVEMENT, Non roulant…). */
function badge(
  doc: jsPDF,
  x: number,
  y: number,
  text: string,
  bg: [number, number, number],
  ink: [number, number, number],
  fs = 5.8,
  dot = false,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs);
  const padX = 2.6;
  const w = doc.getTextWidth(text) + padX * 2 + (dot ? 2.6 : 0);
  const h = fs * 0.62 + 2.6;
  doc.setFillColor(...bg);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  doc.setTextColor(...ink);
  if (dot) {
    doc.circle(x + padX + 0.7, y + h / 2, 0.6, "F");
    doc.text(text, x + padX + 2.6, y + h / 2 + fs * 0.28);
  } else {
    doc.text(text, x + padX, y + h / 2 + fs * 0.28);
  }
  return w;
}

/**
 * Plaque d'immatriculation : rendu strictement identique au badge
 * `.plate-tag` utilisé dans Missions / Attributions.
 */
function plateBadge(doc: jsPDF, x: number, y: number, text: string, fs = 8.4): number {
  return drawPlateTag(doc, x, y, text, fs);
}




/** En-tête clair : logo + identité à gauche, bloc DEVIS à droite. */
function drawHeader(
  doc: jsPDF,
  pageW: number,
  logoData: string | null,
  opts: { numero: string; emission: string; validite: number },
) {
  const right = pageW - M;
  if (logoData) {
    try { doc.addImage(logoData, "PNG", M, 14, 13, 13); } catch { /* logo optionnel */ }
  }
  const tx = M + 17;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.8);
  doc.setTextColor(...INK);
  doc.text("TRANSPORTS ", tx, 20.5);
  const w1 = doc.getTextWidth("TRANSPORTS ");
  doc.setTextColor(...BLUE);
  doc.text("LIGNEO", tx + w1, 20.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.9);
  doc.setTextColor(...MUTED);
  doc.text("Convoyage automobile B2B · Tours (37), France", tx, 25.4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20.5);
  doc.setTextColor(...INK);
  doc.text("DEVIS", right, 21, { align: "right" });
  doc.setFontSize(9.6);
  doc.setTextColor(...BLUE);
  doc.text(opts.numero, right, 26.8, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.9);
  doc.setTextColor(...MUTED);
  doc.text(
    `Émis le ${fmtDate(opts.emission)} · Valable ${opts.validite} jours`,
    right,
    31.6,
    { align: "right" },
  );


  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, 35.5, right, 35.5);
}

/** Pied de page clair : mentions + pastille validité + site. */
function drawFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  company?: CompanyInfo | null,
  validite = 15,
) {
  const right = pageW - M;
  const y = pageH - 16;
  const siren = toSiren(company?.siret);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, y - 6, right, y - 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...FAINT);
  doc.text(
    `${company?.raison_sociale || "Transports Ligneo"}${siren ? ` · SIREN ${siren}` : ""} · Tours (37) · contact@transportsligneo.fr`,
    M,
    y,
  );
  const label = `Devis valable ${validite} jours`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const bw = doc.getTextWidth(label) + 8;
  badge(doc, pageW / 2 - bw / 2, y - 3.8, label, GREEN_SOFT, GREEN_INK, 7, true);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...BLUE);
  doc.text("www.transportsligneo.fr", right, y, { align: "right" });
}

/** Petite carte grise arrondie avec libellé en capitales. */
function card(doc: jsPDF, x: number, y: number, w: number, h: number, label?: string) {
  doc.setFillColor(...CARD);
  doc.roundedRect(x, y, w, h, 2.4, 2.4, "F");
  if (label) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.setTextColor(...FAINT);
    doc.text(label.toUpperCase(), x + 5, y + 6);
  }
}

function sectionLabel(doc: jsPDF, x: number, y: number, text: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.setTextColor(...FAINT);
  doc.text(text.toUpperCase(), x, y);
}


export async function generateDevisPdf(dInput: DevisData, company?: CompanyInfo | null): Promise<Blob> {
  const co = company ?? (await fetchCompanyInfo().catch(() => null));

  // Régime de facturation : micro-entreprise (franchise en base) = prix saisi = net à payer.
  const { regime, vatRate, exemptionNote } = await fetchActiveRegime();
  const micro = regime !== "societe";

  // Devis au nom de l'organisation (rétroactif) : la société prime sur le contact.
  const billing = await resolveClientBillingIdentity({
    userId: (dInput as unknown as { client_user_id?: string | null; user_id?: string | null }).client_user_id
      ?? (dInput as unknown as { user_id?: string | null }).user_id
      ?? null,
    email: dInput.email ?? null,
  });
  const d: DevisData = billing?.societe
    ? {
        ...dInput,
        societe: dInput.societe || billing.societe,
        siret: dInput.siret || billing.siret,
        tva_intra: dInput.tva_intra || billing.tva,
        adresse: dInput.adresse || billing.adresse,
        logo_url: dInput.logo_url || billing.logo_url,
      }
    : dInput;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  applyLigneoFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const innerW = pageW - M * 2;
  const right = pageW - M;

  const logoData = await loadImageAsDataUrl(logoLigneo);
  const signatureData = await loadImageAsDataUrl(signatureGo);
  const clientLogoData = d.logo_url ? await loadImageAsDataUrl(d.logo_url) : null;

  const validite = d.validite_jours ?? 15;
  const emission = d.created_at || new Date().toISOString();

  drawHeader(doc, pageW, logoData, { numero: d.numero, emission, validite });




  // ===== Émetteur / Destinataire =====
  let y = 41;
  const colW = (innerW - 6) / 2;
  const boxH = 33;
  card(doc, M, y, colW, boxH, "Émetteur");
  card(doc, M + colW + 6, y, colW, boxH, "Destinataire");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.8);
  doc.setTextColor(...INK);
  doc.text(co?.raison_sociale || "Transports Ligneo", M + 5, y + 11.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...MUTED);
  const sirenLigneo = toSiren(co?.siret);
  [
    "contact@transportsligneo.fr",
    "07 82 45 61 81",
    sirenLigneo ? `SIREN ${sirenLigneo}` : null,
    "www.transportsligneo.fr",
  ].filter(Boolean).forEach((l, i) => {
    doc.text(l as string, M + 5, y + 16.4 + i * 3.9);
  });

  const dx = M + colW + 6;
  const clientName = d.societe?.trim() || `${d.prenom ?? ""} ${d.nom ?? ""}`.trim() || "Client";
  if (clientLogoData) {
    try { doc.addImage(clientLogoData, "PNG", dx + colW - 16, y + 3.5, 11, 11); } catch { /* optionnel */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.8);
  doc.setTextColor(...INK);
  doc.text(
    (doc.splitTextToSize(clientName, colW - (clientLogoData ? 24 : 10)) as string[])[0],
    dx + 5,
    y + 11.8,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.setTextColor(...MUTED);
  // Adresse complète (2 lignes max) puis email, téléphone et SIRET du client.
  const destAddr = (doc.splitTextToSize(d.adresse || "Adresse à compléter", colW - 10) as string[]).slice(0, 2);
  const destLines = [
    ...destAddr,
    d.email || null,
    d.telephone || null,
    d.siret ? `SIRET ${d.siret}${d.tva_intra ? ` · TVA ${d.tva_intra}` : ""}` : null,
  ].filter(Boolean) as string[];
  let dy = y + 16.4;
  destLines.slice(0, 5).forEach((l) => {
    doc.text((doc.splitTextToSize(l, colW - 10) as string[])[0], dx + 5, dy);
    dy += 3.6;
  });

  y += boxH + 5;


  // ===== Trajet =====
  const rechargeSeule = isDevisRechargeSeule(d);
  const distanceKm = await resolveDistanceKm(d);
  const dateLine = d.date_souhaitee
    ? `${fmtDate(d.date_souhaitee)}${d.heure_souhaitee ? ` à ${d.heure_souhaitee}` : ""}`
    : "Date et heure à déterminer";
  sectionLabel(doc, M, y, "Trajet");
  y += 3.4;
  const trajetH = 27;
  card(doc, M, y, innerW, trajetH);
  const halfCol = innerW / 2 - 22;
  const addrLines = (txt: string, w: number) =>
    (doc.splitTextToSize(txt || "—", w) as string[]).slice(0, 2);
  badge(doc, M + 5, y + 4.5, rechargeSeule ? "RECHARGE" : "ENLÈVEMENT", BLUE_SOFT, BLUE, 6.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(...INK);
  addrLines(d.depart, halfCol).forEach((l, i) => doc.text(l, M + 5, y + 14.6 + i * 4.2));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.9);
  doc.setTextColor(...MUTED);
  doc.text(`Enlèvement souhaité : ${dateLine}`, M + 5, y + 23.4);

  if (!rechargeSeule) {
    const cxm = pageW / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(distanceKm != null ? `≈${distanceKm}` : "—", cxm, y + 13, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    doc.setTextColor(...FAINT);
    doc.text("KM", cxm, y + 17, { align: "center" });
    doc.setFontSize(9.5);
    doc.setTextColor(...FAINT);
    doc.text("→", cxm - 17, y + 13.5, { align: "center" });
    doc.text("→", cxm + 17, y + 13.5, { align: "center" });

    const ax = pageW / 2 + 19;
    badge(doc, ax, y + 4.5, "LIVRAISON", AMBER_SOFT, AMBER_INK, 6.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.2);
    doc.setTextColor(...INK);
    addrLines(d.arrivee, right - ax - 5).forEach((l, i) => doc.text(l, ax, y + 14.6 + i * 4.2));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.9);
    doc.setTextColor(...MUTED);
    doc.text(
      d.duree_estimee ? `Durée estimée : ${d.duree_estimee}` : `Livraison souhaitée : ${dateLine}`,
      ax,
      y + 23.4,
    );
  }
  y += trajetH + 5;


  // ===== Véhicule / Type de prestation =====
  const multiVehicules = (d.vehicules ?? []).filter((v) => v && (v.immatriculation || v.marque || v.modele));
  const isGroupe = multiVehicules.length > 1;
  const parsedSupp = parseDevisSupplements(d.message);
  const plateau = d.plateau ?? parsedSupp.plateau;

  // Aller-retour : les deux véhicules (marque, modèle et plaque) doivent apparaître.
  const optTxt = `${d.option_trajet ?? ""} ${d.prestation ?? ""}`.toLowerCase();
  const isAllerRetour =
    !isGroupe &&
    (!!d.immatriculation_retour ||
      !!d.marque_retour ||
      optTxt.includes("retour") ||
      optTxt.includes("restitution"));
  const identAller =
    [d.marque, d.modele].filter(Boolean).join(" ") || d.type_vehicule || "À préciser (marque / modèle)";
  // Même plaque = même véhicule : on ne recopie la marque de l'aller que dans ce cas,
  // sinon on affiche « Modèle à préciser » (évite deux fois la même marque à tort).
  const norm = (p?: string | null) => (p ?? "").replace(/[\s-]/g, "").toUpperCase();
  const samePlate =
    !!norm(d.immatriculation) && norm(d.immatriculation) === norm(d.immatriculation_retour);
  const identRetourRaw = [d.marque_retour, d.modele_retour].filter(Boolean).join(" ");
  const identRetour = identRetourRaw || (samePlate ? identAller : "Modèle à préciser");

  type VehLine = { tag?: "Aller" | "Retour"; label: string; plate?: string | null; vin?: string | null };
  const vehLines: VehLine[] = isGroupe
    ? [{ label: `${multiVehicules.length} véhicules (devis groupé)` }]
    : isAllerRetour
      ? [
          { tag: "Aller", label: identAller, plate: formatPlate(d.immatriculation), vin: d.vin },
          {
            tag: "Retour",
            label: identRetour,
            // Une plaque retour absente ne signifie pas « même véhicule ».
            // Évite d'imprimer silencieusement deux fois la plaque aller.
            plate: d.immatriculation_retour ? formatPlate(d.immatriculation_retour) : null,
            vin: samePlate ? d.vin_retour ?? d.vin : d.vin_retour,
          },
        ]
      : [{ label: identAller, plate: formatPlate(d.immatriculation), vin: d.vin }];

  const lineH = 12.8;
  const vehH = Math.max(23, 8 + vehLines.length * lineH + (plateau ? 6 : 0));
  card(doc, M, y, colW, vehH, "Véhicule");
  card(doc, M + colW + 6, y, colW, vehH, "Type de prestation");

  let vy = y + 12;
  vehLines.forEach((v) => {
    let vx = M + 5;
    if (v.tag) {
      // Aller en bleu électrique, Retour en ambre : distinction immédiate.
      const isRetour = v.tag === "Retour";
      vx += badge(
        doc,
        vx,
        vy - 3.3,
        v.tag.toUpperCase(),
        isRetour ? AMBER_SOFT : BLUE_SOFT,
        isRetour ? AMBER_INK : BLUE,
        5.8,
      ) + 2.2;
    }
    // Marque / modèle d'abord, puis la plaque.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    doc.setTextColor(...INK);
    const label = (doc.splitTextToSize(v.label, Math.max(12, colW - (vx - M) - 30)) as string[])[0];
    doc.text(label, vx, vy);
    vx += doc.getTextWidth(label) + 2.6;
    if (v.plate) plateBadge(doc, vx, vy - 5.6, v.plate, 8.4);
    if (v.vin) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.4);
      doc.setTextColor(...MUTED);
      doc.text(`VIN ${v.vin.toUpperCase()}`, M + 5, vy + 5.2);
    }
    vy += lineH;
  });

  if (plateau) {
    let bx = M + 5;
    bx += badge(doc, bx, Math.min(vy - 3, y + vehH - 6), "Non roulant", PINK_SOFT, PINK_INK, 6, true) + 2.5;
    badge(doc, bx, Math.min(vy - 3, y + vehH - 6), "Plateau", BLUE_SOFT, BLUE, 6);
  }

  const prestationLabel =
    d.prestation?.trim() ||
    [d.option_trajet, rechargeSeule ? "Recharge uniquement" : "Livraison simple"].filter(Boolean).join(" · ");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.6);
  doc.setTextColor(...INK);
  (doc.splitTextToSize(prestationLabel || "Livraison simple", colW - 10) as string[])
    .slice(0, 2)

    .forEach((l, i) => doc.text(l, M + colW + 11, y + 12 + i * 4.4));
  y += vehH + 6;


  // ===== Lignes de prestation =====
  const ttc = d.prix_estime;
  const ht = micro ? ttc : +(ttc / (1 + vatRate / 100)).toFixed(2);
  const tva = +(ttc - ht).toFixed(2);
  const distance = distanceKm ?? d.distance_km ?? 0;

  const parsedFromMessage = parseDevisOptions(d.message);
  const optionsList = (d.options?.length ? d.options : parsedFromMessage.options).filter(Boolean);
  const pvDigital = d.pv_digital ?? parsedFromMessage.pv;
  const supplements = (d.supplements?.length ? d.supplements : parsedSupp.supplements).filter(
    (s) => s && Number(s.montant) > 0,
  );
  const supplementsTtc = supplements.reduce((s, x) => s + Number(x.montant), 0);
  const baseTtc = Math.max(0, +(ttc - supplementsTtc).toFixed(2));
  const toHt = (v: number) => (micro ? v : +(v / (1 + vatRate / 100)).toFixed(2));
  const baseHt = toHt(baseTtc);

  type Ligne = { title: string; sub?: string; amount: number | null };
  const lignes: Ligne[] = isGroupe
    ? multiVehicules.map((v, i) => {
        const htLigne = toHt(Number(v.prix ?? 0));
        const ident = [v.marque, v.modele].filter(Boolean).join(" ") || "Véhicule";
        const plaque = v.immatriculation ? ` — ${v.immatriculation}` : "";
        return {
          title: `Véhicule ${i + 1} : ${ident}${plaque}`,
          sub: rechargeSeule
            ? `Recharge électrique sur place (sans livraison), ${d.depart}. Branchement, surveillance et contrôle photo.`
            : `${d.depart} → ${v.arrivee || d.arrivee}${plateau ? ", véhicule non roulant transporté sur plateau porte-voiture (non conduit)." : ". Carburant, péages et assurance tous risques inclus."}`,
          amount: htLigne,
        };
      })
    : [
        {
          title: rechargeSeule
            ? "Recharge électrique sur place"
            : plateau
              ? "Transport sur plateau porte-voiture"
              : "Convoyage routier par conducteur professionnel",
          sub: rechargeSeule
            ? `${d.depart} — branchement, surveillance et contrôle photo du niveau de charge.`
            : `${d.depart} → ${d.arrivee}${distance ? `, environ ${Math.round(distance)} km` : ""}${plateau ? ", véhicule non roulant transporté sur plateau porte-voiture (non conduit)." : ". Carburant, péages et assurance tous risques inclus."}`,
          amount: baseHt,
        },
      ];

  supplements.forEach((s) => lignes.push({ title: s.label, amount: toHt(Number(s.montant)) }));

  lignes.push(
    rechargeSeule
      ? {
          title: "Contrôle photo avant / après recharge",
          sub: "Photos horodatées du niveau de charge, compte rendu d'intervention et notifications client.",
          amount: null,
        }
      : {
          title: "État des lieux numérique et suivi de mission",
          sub: "Photos horodatées et signature électronique au départ et à l'arrivée, suivi GPS et notifications client.",
          amount: null,
        },
  );
  if (pvDigital) lignes.push({ title: `PV de livraison digitalisé : ${pvDigital}`, amount: null });
  optionsList.forEach((o) => lignes.push({ title: `Option : ${o}`, amount: null }));
  if (d.destinataire_nom) {
    lignes.push({
      title: "Destinataire",
      sub: [d.destinataire_nom, d.destinataire_tel, d.destinataire_note].filter(Boolean).join(" · "),
      amount: null,
    });
  }

  sectionLabel(doc, M, y, "Prestation");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...FAINT);
  doc.text("MONTANT", right, y, { align: "right" });
  doc.text(micro ? "" : "HT", right, y + 3.4, { align: "right" });
  y += 6;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, y, right, y);
  y += 5.5;

  const descW = innerW - 34;
  // Compression automatique : le devis doit tenir sur une seule page.
  const measure = (subFs: number, gap: number, keepSub: boolean) =>
    lignes.reduce((acc, l) => {
      const s = l.sub && keepSub ? (doc.setFontSize(subFs), (doc.splitTextToSize(l.sub, descW) as string[]).length) : 0;
      return acc + 4.2 + s * (subFs * 0.5) + 2 + gap;
    }, 0);
  const sigBlockH = 24;
  const availableForLines = pageH - 24 - sigBlockH - 6 - 46 - y; // conditions ~46mm réservés
  doc.setFont("helvetica", "normal");
  let subFs = 7.1;
  let gap = 4.2;
  let keepSub = true;
  if (measure(subFs, gap, keepSub) > availableForLines) { subFs = 6.4; gap = 3.4; }
  if (measure(subFs, gap, keepSub) > availableForLines) { keepSub = false; gap = 2.8; }

  lignes.forEach((l) => {
    const sub = l.sub && keepSub
      ? (doc.setFont("helvetica", "normal"), doc.setFontSize(subFs), doc.splitTextToSize(l.sub, descW) as string[])
      : [];
    const lh = subFs * 0.52;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.9);
    doc.setTextColor(...INK);
    doc.text((doc.splitTextToSize(l.title, descW) as string[])[0], M, y);
    doc.text(l.amount === null ? "Inclus" : eur(l.amount), right, y, { align: "right" });
    let sy = y + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(subFs);
    doc.setTextColor(...MUTED);
    sub.forEach((s) => { doc.text(s, M, sy); sy += lh; });
    y = sy + 1.8;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, y, right, y);
    y += gap;
  });


  // ===== Totaux =====
  const totX = pageW / 2 + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.7);
  doc.setTextColor(...MUTED);
  doc.text(micro ? "Total" : "Total HT", totX, y);
  doc.setTextColor(...INK);
  doc.text(eur(ht), right, y, { align: "right" });
  y += 5;
  doc.setTextColor(...MUTED);
  if (micro) {
    doc.text("TVA", totX, y);
    doc.setTextColor(...INK);
    doc.text("Non applicable", right, y, { align: "right" });
  } else {
    doc.text(`TVA (${String(vatRate).replace(".", ",")} %)`, totX, y);
    doc.setTextColor(...INK);
    doc.text(eur(tva), right, y, { align: "right" });
  }
  y += 3.6;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(totX, y, right, y);
  y += 5.6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.6);
  doc.setTextColor(...INK);
  doc.text(micro ? "Total net à payer" : "Total TTC", totX, y);
  doc.setTextColor(...BLUE);
  doc.text(eur(ttc), right, y, { align: "right" });
  y += 7;

  // ===== Conditions et précisions =====
  const conditions: Array<[string, string]> = [
    ...(plateau
      ? ([["Véhicule non roulant", "transport exclusivement sur plateau porte-voiture. Prévoir un accès dégagé (zone plane et accessible)."]] as Array<[string, string]>)
      : []),
    ["État des lieux numérique", "photos horodatées et signature électronique au départ et à l'arrivée."],
    ["Délai indicatif", "3 à 5 jours ouvrés selon disponibilité du transporteur et conditions de circulation."],
    ["Tarif estimatif", "confirmé après validation de l'adresse exacte, du modèle / poids du véhicule et de l'accessibilité des sites."],
    ["Validité", `devis valable ${validite} jours à compter de l'émission, aucun acompte demandé à la réservation.`],
    ...(micro ? ([["TVA", exemptionNote]] as Array<[string, string]>) : []),
    ["CGV", "prestation soumise aux conditions générales de vente (www.transportsligneo.fr/cgv)."],
  ];

  const sigH = 24;
  const sigTop = pageH - 24 - sigH;
  const condW = innerW - 14;
  let condFs = 6.9;
  let condLh = 3.3;
  const wrapConds = (fs: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    return conditions.map(([k, v]) => doc.splitTextToSize(`${k} : ${v}`, condW - 4) as string[]);
  };
  let condWrapped = wrapConds(condFs);
  const condHeight = (w: string[][], lh: number) => 9 + w.reduce((a, x) => a + x.length * lh + 1.1, 0) + 2.5;
  let condH = condHeight(condWrapped, condLh);
  if (y + condH + 5 > sigTop) {
    condFs = 6.2;
    condLh = 3.0;
    condWrapped = wrapConds(condFs);
    condH = condHeight(condWrapped, condLh);
  }
  if (y + condH + 5 > sigTop) condH = Math.max(20, sigTop - 5 - y);
  card(doc, M, y, innerW, condH, "Conditions et précisions");
  let cy2 = y + 11;
  condWrapped.forEach((w, i) => {
    if (cy2 + w.length * condLh > y + condH - 1) return;
    doc.setFillColor(...FAINT);
    doc.circle(M + 6, cy2 - 1.1, 0.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(condFs);
    doc.setTextColor(...MUTED);
    doc.text(w, M + 9, cy2);
    // Mise en avant du terme en gras
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(`${conditions[i][0]} `, M + 9, cy2);
    cy2 += w.length * condLh + 1.1;
  });
  y = sigTop;


  // ===== Signatures =====

  const sigW = (innerW - 6) / 2;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, sigW, sigH, 2.4, 2.4, "S");
  doc.roundedRect(M + sigW + 6, y, sigW, sigH, 2.4, 2.4, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.setTextColor(...FAINT);
  doc.text("BON POUR ACCORD — CLIENT", M + 5, y + 6);
  doc.text("POUR TRANSPORTS LIGNEO", M + sigW + 11, y + 6);

  if (d.clientSignatureDataUrl) {
    try { doc.addImage(d.clientSignatureDataUrl, "PNG", M + 5, y + 7, 34, 11); } catch { /* optionnel */ }
  }
  if (signatureData) {
    try { doc.addImage(signatureData, "PNG", M + sigW + 11, y + 7, 32, 11); } catch { /* optionnel */ }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.3);
  doc.setTextColor(...MUTED);
  doc.text(
    d.acceptedAtLabel
      ? `Signé électroniquement le ${d.acceptedAtLabel}`
      : "Signature et cachet du client — date : ____ / ____ / ______",
    M + 5,
    y + sigH - 3.5,
  );
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Olivier G. — Fondateur", M + sigW + 11, y + sigH - 3.5);

  drawFooter(doc, pageW, pageH, co, validite);

  // ===== Cartouche preuve de signature électronique (page dédiée) =====
  if (d.otpProof) {
    doc.addPage();
    applyLigneoFonts(doc);
    drawHeader(doc, pageW, logoData, { numero: d.numero, emission, validite });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text("SIGNATURE ÉLECTRONIQUE", M, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    doc.setTextColor(...MUTED);
    doc.text("Preuve de validation — conforme eIDAS (signature électronique simple)", M, 56);

    const boxY = 64;
    card(doc, M, boxY, innerW, 126);

    const rows: [string, string][] = [
      ["Devis", `${d.numero}${d.version && d.version > 1 ? ` (v${d.version})` : ""}`],
      ["Signataire", `${d.prenom ?? ""} ${d.nom ?? ""}`.trim() || "-"],
      ["E-mail vérifié", d.otpProof.email],
      ["Méthode", d.otpProof.method],
      ["Date et heure de signature", d.otpProof.acceptedAtLabel],
      ["Montant TTC accepté", eur(ttc)],
      ["Adresse IP", d.otpProof.ipAddress ?? "-"],
      ["Navigateur", (d.otpProof.userAgent ?? "-").slice(0, 90)],
      ["Version des CGV acceptées", d.otpProof.cgvVersion ?? "-"],
      ["Empreinte SHA-256 du devis", d.otpProof.pdfHash ?? "(voir document)"],
    ];

    let py = boxY + 9;
    rows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...FAINT);
      doc.text(label.toUpperCase(), M + 6, py);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      doc.setTextColor(...INK);
      const wrapped = doc.splitTextToSize(String(value ?? "-"), innerW - 12) as string[];
      doc.text(wrapped, M + 6, py + 4.4);
      py += 4.4 + wrapped.length * 4 + 3.2;
    });

    const bY = boxY + 134;
    doc.setFillColor(...BLUE_SOFT);
    doc.roundedRect(M, bY, innerW, 22, 2.4, 2.4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BLUE);
    doc.text("DEVIS SIGNÉ ET VERROUILLÉ", pageW / 2, bY + 9, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      "Ce devis a été accepté via un code de validation unique envoyé au signataire.",
      pageW / 2,
      bY + 15,
      { align: "center" },
    );

    drawFooter(doc, pageW, pageH, co, validite);
  }

  return doc.output("blob");
}

export function downloadDevisPdf(blob: Blob, numero: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Devis-${numero}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
