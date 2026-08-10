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
  /** Options additionnelles cochees (recharge, lavage, mise en main...) */
  options?: string[] | null;
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

const NAVY: [number, number, number] = [12, 22, 56];
const GOLD: [number, number, number] = [176, 137, 44];
const GOLD_SOFT: [number, number, number] = [214, 183, 106];
const TEXT: [number, number, number] = [34, 38, 48];
const MUTED: [number, number, number] = [128, 134, 148];
const LINE: [number, number, number] = [222, 226, 234];
const SOFT_BG: [number, number, number] = [245, 246, 250];
const WHITE: [number, number, number] = [255, 255, 255];

const M = 15; // marge du gabarit

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
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return d; }
};

const addDays = (iso: string | undefined, days: number) => {
  const base = iso ? new Date(iso) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
};

/** Bandeau d'en-tête navy + filet doré (gabarit officiel). */
function drawHeader(doc: jsPDF, pageW: number, logoData: string | null) {
  const w = pageW - M * 2;
  doc.setFillColor(...NAVY);
  doc.rect(M, 12, w, 24, "F");
  if (logoData) {
    try { doc.addImage(logoData, "PNG", M + 5, 15, 18, 18); } catch { /* logo optionnel */ }
  }
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.text("TRANSPORTS LIGNEO", M + 29, 23.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...GOLD_SOFT);
  doc.text("CONVOYAGE AUTOMOBILE PREMIUM — FRANCE & EUROPE", M + 29, 29.5);
  doc.setFillColor(...GOLD);
  doc.rect(M, 37.2, w, 0.9, "F");
}

/** Pied de page navy avec mentions légales dynamiques. */
function drawFooter(doc: jsPDF, pageW: number, pageH: number, company?: CompanyInfo | null) {
  const w = pageW - M * 2;
  const y = pageH - 34;
  doc.setFillColor(...NAVY);
  doc.rect(M, y, w, 20, "F");
  const cx = pageW / 2;
  doc.setTextColor(...GOLD_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text((company?.raison_sociale || "TRANSPORTS LIGNEO").toUpperCase(), cx, y + 6.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(215, 220, 235);
  const l1 = companyLegalLine1(company);
  const l2 = companyLegalLine2(company);
  doc.text(l1 || "SASU — RCS Tours — SIRET — TVA", cx, y + 11.5, { align: "center", maxWidth: w - 12 });
  doc.text(
    l2 || "37000 Tours, France — contact@transportsligneo.fr — 07 82 45 61 81 — www.transportsligneo.fr",
    cx,
    y + 16,
    { align: "center", maxWidth: w - 12 },
  );
}

function labelValue(doc: jsPDF, x: number, y: number, label: string, value: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...TEXT);
  doc.text(label, x, y);
  const lw = doc.getTextWidth(label);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(value, x + lw + 1.5, y);
}

export async function generateDevisPdf(dInput: DevisData, company?: CompanyInfo | null): Promise<Blob> {
  const co = company ?? (await fetchCompanyInfo().catch(() => null));

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

  drawHeader(doc, pageW, logoData);

  // ===== Titre DEVIS =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...NAVY);
  doc.text("DEVIS", M, 52);
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(`N° ${d.numero}${d.version && d.version > 1 ? ` · v${d.version}` : ""}`, M, 59.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...MUTED);
  doc.text("Date d'émission", right, 46, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(fmtDate(emission), right, 51.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...MUTED);
  doc.text("Valable jusqu'au", right, 57.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(fmtDate(addDays(emission, validite)), right, 63, { align: "right" });

  // ===== Blocs client / référence mission =====
  const blockY = 70;
  const blockH = 32;
  doc.setFillColor(...SOFT_BG);
  doc.rect(M, blockY, 88, blockH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text("DEVIS ÉTABLI POUR", M + 5, blockY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(
    doc.splitTextToSize(d.societe?.trim() || `${d.prenom} ${d.nom}`.trim() || "Client", 72)[0],
    M + 5,
    blockY + 13,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...TEXT);
  let cy = blockY + 18.5;
  const contactName = `${d.prenom ?? ""} ${d.nom ?? ""}`.trim();
  if (d.societe?.trim() && contactName) {
    doc.text(`À l'attention de ${contactName}`, M + 5, cy);
    cy += 4.4;
  }
  if (d.adresse) {
    doc.splitTextToSize(d.adresse, 76).slice(0, 2).forEach((l: string) => {
      doc.text(l, M + 5, cy);
      cy += 4.4;
    });
  } else if (d.email) {
    doc.text(d.email, M + 5, cy);
    cy += 4.4;
  }
  doc.setFontSize(7.6);
  doc.setTextColor(...MUTED);
  const legal = [d.siret ? `SIRET ${d.siret}` : null, d.tva_intra ? `TVA ${d.tva_intra}` : null]
    .filter(Boolean)
    .join(" — ");
  if (legal) doc.text(doc.splitTextToSize(legal, 76)[0], M + 5, Math.min(cy, blockY + blockH - 3));

  if (clientLogoData) {
    try { doc.addImage(clientLogoData, "PNG", M + 88 - 22, blockY + 4, 16, 16); } catch { /* optionnel */ }
  }

  // Colonne droite
  const rx = M + 97;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text("RÉFÉRENCE MISSION", rx, blockY + 6);

  const vehicule = [d.marque, d.modele, d.immatriculation].filter(Boolean).join(" ")
    || d.type_vehicule || "—";
  let ry = blockY + 13;
  // Trajet sur 2 lignes max (adresses longues)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...TEXT);
  doc.text("Trajet :", rx, ry);
  const trajetLines = (doc.splitTextToSize(`${d.depart} -> ${d.arrivee}`, 72) as string[]).slice(0, 2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(trajetLines, rx + 13, ry);
  ry += 5.2 * trajetLines.length;
  labelValue(doc, rx, ry, "Véhicule : ", vehicule);
  ry += 5.2;
  labelValue(doc, rx, ry, "Enlèvement souhaité : ", d.date_souhaitee ? fmtDate(d.date_souhaitee) : "—");
  ry += 5.2;
  labelValue(doc, rx, ry, "Contact commercial : ", "Olivier G.");


  // ===== Tableau prestation =====
  let y = blockY + blockH + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.4);
  doc.setTextColor(...NAVY);
  doc.text("DÉTAIL DE LA PRESTATION", M, y);

  y += 4;
  const colDescX = M + 4;
  const sepQty = M + 100;
  const sepUnit = M + 128;
  const sepTotal = M + 156;
  const colQtyC = (sepQty + sepUnit) / 2;
  const colUnitR = sepTotal - 4;
  const colTotalR = right - 4;


  doc.setFillColor(...NAVY);
  doc.rect(M, y, innerW, 9, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(7.8);
  doc.text("Description", colDescX, y + 5.9);
  doc.text("Quantité", colQtyC, y + 5.9, { align: "center" });
  doc.text("Prix unit. HT", colUnitR, y + 5.9, { align: "right" });
  doc.text("Total HT", colTotalR, y + 5.9, { align: "right" });
  y += 9;

  const ttc = d.prix_estime;
  const ht = +(ttc / 1.2).toFixed(2);
  const tva = +(ttc - ht).toFixed(2);
  const distance = d.distance_km ?? 0;

  const lignes: Array<{ desc: string; qty: string; unit: string; total: string }> = [
    {
      desc: `Convoyage routier ${d.depart} -> ${d.arrivee}${distance ? ` (${distance} km)` : ""}. Inclus : carburant, péages, assurance tous risques`,
      qty: "1",
      unit: eur(ht),
      total: eur(ht),
    },
    { desc: "État des lieux contradictoire départ / arrivée avec constat photo", qty: "1", unit: "Inclus", total: eur(0) },
    { desc: "Suivi GPS temps réel + notifications client", qty: "1", unit: "Inclus", total: eur(0) },
  ];
  if (d.option_trajet) {
    lignes.push({ desc: `Type de trajet : ${d.option_trajet}`, qty: "1", unit: "Inclus", total: eur(0) });
  }
  if (d.pv_digital) {
    lignes.push({ desc: `PV de livraison digitalisé : ${d.pv_digital}`, qty: "1", unit: "Inclus", total: eur(0) });
  }
  (d.options ?? []).forEach((o) => lignes.push({ desc: o, qty: "1", unit: "Inclus", total: eur(0) }));
  if (d.destinataire_nom) {
    lignes.push({
      desc: `Destinataire : ${[d.destinataire_nom, d.destinataire_tel].filter(Boolean).join(" — ")}`,
      qty: "1",
      unit: "Inclus",
      total: eur(0),
    });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  const labelR = sepUnit - 4;
  lignes.forEach((l) => {
    const wrapped = doc.splitTextToSize(l.desc, sepQty - M - 8) as string[];
    const h = Math.max(10.5, wrapped.length * 4.4 + 5.5);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.rect(M, y, innerW, h, "S");
    doc.line(sepQty, y, sepQty, y + h);
    doc.line(sepUnit, y, sepUnit, y + h);
    doc.line(sepTotal, y, sepTotal, y + h);

    doc.setTextColor(...TEXT);
    doc.text(wrapped, colDescX, y + 5.6);
    doc.text(l.qty, colQtyC, y + h / 2 + 1.2, { align: "center" });
    if (l.unit === "Inclus") doc.setTextColor(...MUTED);
    doc.text(l.unit, colUnitR, y + h / 2 + 1.2, { align: "right" });
    doc.setTextColor(...TEXT);
    doc.text(l.total, colTotalR, y + h / 2 + 1.2, { align: "right" });
    y += h;
  });

  // ===== Totaux =====
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text("Total HT", labelR, y, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(eur(ht), colTotalR, y, { align: "right" });

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT);
  doc.text("TVA (20 %)", labelR, y, { align: "right" });
  doc.text(eur(tva), colTotalR, y, { align: "right" });

  y += 4;
  doc.setFillColor(...NAVY);
  doc.rect(sepQty, y, right - sepQty, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text("TOTAL TTC", labelR, y + 7.8, { align: "right" });
  doc.setFontSize(10.5);
  doc.text(eur(ttc), colTotalR, y + 7.8, { align: "right" });
  y += 16;

  // ===== Conditions =====
  const conditions = [
    `Devis valable ${validite} jours à compter de la date d'émission. Prix révisable au-delà.`,
    `Règlement par ${(d.mode_paiement || "carte bancaire").toLowerCase()}, aucun acompte demandé à la réservation.`,
    "Convoyeur assuré et vérifié (permis, casier judiciaire, RC Pro convoyage).",
    "Un état des lieux contradictoire est réalisé au départ et à l'arrivée, avec photos horodatées, et le devis est soumis aux CGV (www.transportsligneo.fr/cgv).",
  ];

  // Conditions sur 2 colonnes (compact) pour tenir sur une page
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  const colW = (innerW - 8) / 2;
  const wrappedCols = conditions.map((c) => doc.splitTextToSize(`• ${c}`, colW) as string[]);
  const leftCols = wrappedCols.slice(0, Math.ceil(wrappedCols.length / 2));
  const rightCols = wrappedCols.slice(Math.ceil(wrappedCols.length / 2));
  const colLines = Math.max(
    leftCols.reduce((a, w) => a + w.length + 0.4, 0),
    rightCols.reduce((a, w) => a + w.length + 0.4, 0),
  );
  const condH = colLines * 4.1;
  const needed = 6.5 + condH + 30;
  if (y + needed > pageH - 26) {
    drawFooter(doc, pageW, pageH, co);
    doc.addPage();
    applyLigneoFonts(doc);
    drawHeader(doc, pageW, logoData);
    y = 50;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...NAVY);
  doc.text("CONDITIONS", M, y);
  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...TEXT);
  const condTop = y;
  let ly = condTop;
  leftCols.forEach((w) => { doc.text(w, M, ly); ly += w.length * 4.1 + 1.4; });
  let ry2 = condTop;
  rightCols.forEach((w) => { doc.text(w, M + colW + 8, ry2); ry2 += w.length * 4.1 + 1.4; });
  y = Math.max(ly, ry2);

  // ===== Signatures =====
  y += 8;


  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text("Bon pour accord, le : ________________", M + 5, y);
  doc.text("Pour Transports Ligneo", right, y, { align: "right" });

  if (d.clientSignatureDataUrl) {
    try { doc.addImage(d.clientSignatureDataUrl, "PNG", M + 5, y + 3, 38, 15); } catch { /* optionnel */ }
  }
  if (signatureData) {
    try { doc.addImage(signatureData, "PNG", right - 38, y + 3, 34, 15); } catch { /* optionnel */ }
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  doc.text("Signature et cachet client", M + 5, y + 21);
  doc.text("Olivier G. — Fondateur", right, y + 21, { align: "right" });
  if (d.acceptedAtLabel) {
    doc.setFontSize(7);
    doc.text(`Signé électroniquement le ${d.acceptedAtLabel}`, M + 5, y + 25.5);
  }

  drawFooter(doc, pageW, pageH, co);

  // ===== Cartouche preuve de signature électronique (page dédiée) =====
  if (d.otpProof) {
    doc.addPage();
    applyLigneoFonts(doc);
    drawHeader(doc, pageW, logoData);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.text("SIGNATURE ÉLECTRONIQUE", M, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Preuve de validation — conforme eIDAS (signature électronique simple)", M, 59);

    const boxY = 68;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.setFillColor(...SOFT_BG);
    doc.rect(M, boxY, innerW, 128, "FD");

    const rows: [string, string][] = [
      ["Devis", `${d.numero}${d.version && d.version > 1 ? ` (v${d.version})` : ""}`],
      ["Signataire", `${d.prenom} ${d.nom}`.trim() || "-"],
      ["E-mail vérifié", d.otpProof.email],
      ["Méthode", d.otpProof.method],
      ["Date et heure de signature", d.otpProof.acceptedAtLabel],
      ["Montant TTC accepté", eur(ttc)],
      ["Adresse IP", d.otpProof.ipAddress ?? "-"],
      ["Navigateur", (d.otpProof.userAgent ?? "-").slice(0, 90)],
      ["Version des CGV acceptées", d.otpProof.cgvVersion ?? "-"],
      ["Empreinte SHA-256 du devis", d.otpProof.pdfHash ?? "(voir document)"],
    ];

    let py = boxY + 10;
    rows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...MUTED);
      doc.text(label.toUpperCase(), M + 6, py);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      const wrapped = doc.splitTextToSize(String(value ?? "-"), innerW - 12) as string[];
      doc.text(wrapped, M + 6, py + 4.6);
      py += 4.6 + wrapped.length * 4.2 + 3.2;
    });

    const bY = boxY + 136;
    doc.setFillColor(...NAVY);
    doc.rect(M, bY, innerW, 24, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...GOLD_SOFT);
    doc.text("DEVIS SIGNÉ ET VERROUILLÉ", pageW / 2, bY + 9, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(215, 220, 235);
    doc.text(
      "Ce devis a été accepté via un code de validation unique envoyé par e-mail au signataire.",
      pageW / 2,
      bY + 15.5,
      { align: "center" },
    );
    doc.text(
      "La preuve est conservée dans nos systèmes pendant toute la durée légale.",
      pageW / 2,
      bY + 20,
      { align: "center" },
    );

    drawFooter(doc, pageW, pageH, co);
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
