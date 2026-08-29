import jsPDF from "jspdf";
// Logo officiel carré 1:1 — évite l'écrasement subi par logo-ligneo.png (ratio 2.65)
import { LIGNEO_BRAND_LOGO as logoLigneo } from "@/lib/brand-assets";
import signatureGo from "@/assets/signature-go.png";
import {
  fetchCompanyInfo,
  companyLegalLine1,
  companyLegalLine2,
  resolveClientBillingIdentity,
  type CompanyInfo,
} from "@/lib/doc-branding";
import { applyLigneoFonts } from "@/lib/pdf-fonts";
import { fetchActiveRegime } from "@/lib/pricing/fetch";


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
  /** Aller-retour : vehicule restitue (souvent une autre plaque) */
  marque_retour?: string | null;
  modele_retour?: string | null;
  immatriculation_retour?: string | null;
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
    marque_retour: g<string | null>("marque_retour"),
    modele_retour: g<string | null>("modele_retour"),
    immatriculation_retour: g<string | null>("immatriculation_retour"),
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
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  doc.text("TRANSPORTS ", tx, 20.5);
  const w1 = doc.getTextWidth("TRANSPORTS ");
  doc.setTextColor(...BLUE);
  doc.text("LIGNEO", tx + w1, 20.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text("Convoyage automobile B2B · Tours (37), France", tx, 25.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...INK);
  doc.text("DEVIS", right, 21, { align: "right" });
  doc.setFontSize(8.6);
  doc.setTextColor(...BLUE);
  doc.text(opts.numero, right, 26.6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text(
    `Émis le ${fmtDate(opts.emission)} · Valable ${opts.validite} jours`,
    right,
    31.4,
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
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, y - 6, right, y - 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...FAINT);
  doc.text(
    `${company?.raison_sociale || "Transports Ligneo"} · Tours (37) · contact@transportsligneo.fr`,
    M,
    y,
  );
  const label = `Devis valable ${validite} jours`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  const bw = doc.getTextWidth(label) + 8;
  badge(doc, pageW / 2 - bw / 2, y - 3.6, label, GREEN_SOFT, GREEN_INK, 6.8, true);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...BLUE);
  doc.text("www.transportsligneo.fr", right, y, { align: "right" });
}

/** Petite carte grise arrondie avec libellé en capitales. */
function card(doc: jsPDF, x: number, y: number, w: number, h: number, label?: string) {
  doc.setFillColor(...CARD);
  doc.roundedRect(x, y, w, h, 2.4, 2.4, "F");
  if (label) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...FAINT);
    doc.text(label.toUpperCase(), x + 5, y + 6);
  }
}

function sectionLabel(doc: jsPDF, x: number, y: number, text: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
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

  const bottomLimit = pageH - 26;
  const newPage = () => {
    drawFooter(doc, pageW, pageH, co, validite);
    doc.addPage();
    applyLigneoFonts(doc);
    drawHeader(doc, pageW, logoData, { numero: d.numero, emission, validite });
    return 44;
  };

  // ===== Émetteur / Destinataire =====
  let y = 41;
  const colW = (innerW - 6) / 2;
  const boxH = 24;
  card(doc, M, y, colW, boxH, "Émetteur");
  card(doc, M + colW + 6, y, colW, boxH, "Destinataire");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(co?.raison_sociale || "Transports Ligneo", M + 5, y + 11.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  ["contact@transportsligneo.fr", "07 82 45 61 81", "www.transportsligneo.fr"].forEach((l, i) => {
    doc.text(l, M + 5, y + 15.8 + i * 3.5);
  });

  const dx = M + colW + 6;
  const clientName = d.societe?.trim() || `${d.prenom ?? ""} ${d.nom ?? ""}`.trim() || "Client";
  if (clientLogoData) {
    try { doc.addImage(clientLogoData, "PNG", dx + colW - 16, y + 3.5, 11, 11); } catch { /* optionnel */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(
    (doc.splitTextToSize(clientName, colW - (clientLogoData ? 24 : 10)) as string[])[0],
    dx + 5,
    y + 11.5,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const destLines = [
    d.adresse || "Adresse à compléter",
    d.email || null,
    d.telephone || null,
    [d.siret ? `SIRET ${d.siret}` : null, d.tva_intra ? `TVA ${d.tva_intra}` : null].filter(Boolean).join(" · ") || null,
  ].filter(Boolean) as string[];
  let dy = y + 15.8;
  destLines.slice(0, 3).forEach((l) => {
    doc.text((doc.splitTextToSize(l, colW - 10) as string[])[0], dx + 5, dy);
    dy += 3.5;
  });

  y += boxH + 5;


  // ===== Trajet =====
  const rechargeSeule = isDevisRechargeSeule(d);
  sectionLabel(doc, M, y, "Trajet");
  y += 3;
  const trajetH = 21;
  card(doc, M, y, innerW, trajetH);
  const halfCol = innerW / 2 - 22;
  badge(doc, M + 5, y + 4.5, rechargeSeule ? "RECHARGE" : "ENLÈVEMENT", BLUE_SOFT, BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(...INK);
  doc.text((doc.splitTextToSize(d.depart || "—", halfCol) as string[])[0], M + 5, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(...MUTED);
  doc.text("Adresse d'enlèvement à confirmer", M + 5, y + 18);

  if (!rechargeSeule) {
    const cxm = pageW / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(d.distance_km ? `≈${Math.round(d.distance_km)}` : "—", cxm, y + 11.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.6);
    doc.setTextColor(...FAINT);
    doc.text("KM", cxm, y + 15, { align: "center" });
    doc.setFontSize(9);
    doc.setTextColor(...FAINT);
    doc.text("→", cxm - 16, y + 12, { align: "center" });
    doc.text("→", cxm + 16, y + 12, { align: "center" });

    const ax = pageW / 2 + 18;
    badge(doc, ax, y + 4.5, "LIVRAISON", AMBER_SOFT, AMBER_INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.2);
    doc.setTextColor(...INK);
    doc.text((doc.splitTextToSize(d.arrivee || "—", right - ax - 5) as string[])[0], ax, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    doc.setTextColor(...MUTED);
    doc.text("Adresse de livraison à confirmer", ax, y + 18);
  }
  y += trajetH + 5;


  // ===== Véhicule / Type de prestation =====
  const multiVehicules = (d.vehicules ?? []).filter((v) => v && (v.immatriculation || v.marque || v.modele));
  const isGroupe = multiVehicules.length > 1;
  const parsedSupp = parseDevisSupplements(d.message);
  const plateau = d.plateau ?? parsedSupp.plateau;

  const vehiculeLabel = isGroupe
    ? `${multiVehicules.length} véhicules (devis groupé)`
    : [d.marque, d.modele].filter(Boolean).join(" ") || d.type_vehicule || "À préciser (marque / modèle)";
  const vehH = 21;
  card(doc, M, y, colW, vehH, "Véhicule");
  card(doc, M + colW + 6, y, colW, vehH, "Type de prestation");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text((doc.splitTextToSize(vehiculeLabel, colW - 10) as string[])[0], M + 5, y + 12);
  let bx = M + 5;
  if (plateau) {
    bx += badge(doc, bx, y + 14.6, "Non roulant", PINK_SOFT, PINK_INK, 5.8, true) + 2.5;
    badge(doc, bx, y + 14.6, "Livraison sur plateau", BLUE_SOFT, BLUE, 5.8);
  } else if (d.immatriculation) {
    badge(doc, bx, y + 14.6, d.immatriculation, BLUE_SOFT, BLUE, 5.8);
  }
  const prestationLabel =
    d.prestation?.trim() ||
    [d.option_trajet, rechargeSeule ? "Recharge uniquement" : "Livraison simple"].filter(Boolean).join(" · ");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  (doc.splitTextToSize(prestationLabel || "Livraison simple", colW - 10) as string[])
    .slice(0, 2)
    .forEach((l, i) => doc.text(l, M + colW + 11, y + 12 + i * 4.4));
  y += vehH + 6;


  // ===== Lignes de prestation =====
  const ttc = d.prix_estime;
  const ht = micro ? ttc : +(ttc / (1 + vatRate / 100)).toFixed(2);
  const tva = +(ttc - ht).toFixed(2);
  const distance = d.distance_km ?? 0;

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
  let subFs = 6.6;
  let gap = 4;
  let keepSub = true;
  if (measure(subFs, gap, keepSub) > availableForLines) { subFs = 6; gap = 3.2; }
  if (measure(subFs, gap, keepSub) > availableForLines) { keepSub = false; gap = 2.8; }

  lignes.forEach((l) => {
    const sub = l.sub && keepSub
      ? (doc.setFont("helvetica", "normal"), doc.setFontSize(subFs), doc.splitTextToSize(l.sub, descW) as string[])
      : [];
    const lh = subFs * 0.52;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
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
  if (y + 30 > bottomLimit) y = newPage();
  const totX = pageW / 2 + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...MUTED);
  doc.text(micro ? "Total" : "Total HT", totX, y);
  doc.setTextColor(...INK);
  doc.text(eur(ht), right, y, { align: "right" });
  y += 6;
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
  y += 4.5;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(totX, y, right, y);
  y += 6.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(micro ? "Total net à payer" : "Total TTC", totX, y);
  doc.setTextColor(...BLUE);
  doc.text(eur(ttc), right, y, { align: "right" });
  y += 10;

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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  const condW = innerW - 14;
  const condWrapped = conditions.map(([k, v]) => doc.splitTextToSize(`${k} : ${v}`, condW - 4) as string[]);
  const condH = 10 + condWrapped.reduce((a, w) => a + w.length * 3.4 + 1.4, 0) + 3;
  if (y + condH > bottomLimit) y = newPage();
  card(doc, M, y, innerW, condH, "Conditions et précisions");
  let cy2 = y + 12;
  condWrapped.forEach((w, i) => {
    doc.setFillColor(...FAINT);
    doc.circle(M + 6, cy2 - 1.1, 0.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(w, M + 9, cy2);
    // Mise en avant du terme en gras
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(`${conditions[i][0]} `, M + 9, cy2);
    cy2 += w.length * 3.4 + 1.4;
  });
  y += condH + 9;

  // ===== Signatures =====
  const sigH = 30;
  if (y + sigH > bottomLimit) y = newPage();
  const sigW = (innerW - 6) / 2;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, sigW, sigH, 2.4, 2.4, "S");
  doc.roundedRect(M + sigW + 6, y, sigW, sigH, 2.4, 2.4, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...FAINT);
  doc.text("BON POUR ACCORD — CLIENT", M + 5, y + 6);
  doc.text("POUR TRANSPORTS LIGNEO", M + sigW + 11, y + 6);

  if (d.clientSignatureDataUrl) {
    try { doc.addImage(d.clientSignatureDataUrl, "PNG", M + 5, y + 8.5, 34, 13); } catch { /* optionnel */ }
  }
  if (signatureData) {
    try { doc.addImage(signatureData, "PNG", M + sigW + 11, y + 8.5, 32, 13); } catch { /* optionnel */ }
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text(
    d.acceptedAtLabel
      ? `Signé électroniquement le ${d.acceptedAtLabel}`
      : "Signature et cachet du client — date : ____ / ____ / ______",
    M + 5,
    y + sigH - 4,
  );
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Olivier G. — Fondateur", M + sigW + 11, y + sigH - 4);

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
