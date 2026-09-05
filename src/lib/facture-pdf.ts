import jsPDF from "jspdf";
// Logo officiel carré 1:1 — évite l'écrasement subi par logo-ligneo.png (ratio 2.65)
import { LIGNEO_BRAND_LOGO as logoLigneo } from "@/lib/brand-assets";
import signatureGo from "@/assets/signature-go.png";
import { supabase } from "@/integrations/supabase/client";
import { parseDevisOptions, parseDevisSupplements } from "@/lib/devis-pdf";
import { resolveInvoiceMention } from "@/lib/invoice-settings";

import {
  fetchCompanyInfo,
  companyAddressLine,
  companyLegalLine2,
  resolveClientBillingIdentity,
  toSiren,
  type CompanyInfo,
} from "@/lib/doc-branding";
import { applyLigneoFonts } from "@/lib/pdf-fonts";
import { drawPlateTag } from "@/lib/pdf-plate";



export interface FactureData {
  numero: string;
  type_facture: "particulier" | "b2b";
  statut?: string;
  date_facture?: string;
  date_mission?: string | null;
  date_echeance?: string | null;
  date_paiement?: string | null;
  paid_at?: string | null;
  mode_paiement?: string | null;
  conditions_paiement?: string | null;
  client_nom?: string | null;
  client_prenom?: string | null;
  client_societe?: string | null;
  client_fonction?: string | null;
  client_email?: string | null;
  client_telephone?: string | null;
  client_adresse?: string | null;
  client_siret?: string | null;
  client_tva?: string | null;
  /** Logo public de la société cliente — affiché dans le bloc "FACTURÉ À". */
  client_logo_url?: string | null;
  designation?: string | null;
  depart?: string | null;
  arrivee?: string | null;
  distance_km?: number | null;
  vehicule_marque?: string | null;
  vehicule_modele?: string | null;
  vehicule_immatriculation?: string | null;
  vehicule_vin?: string | null;
  km_depart?: number | null;
  km_arrivee?: number | null;
  prix_ht: number;
  tva_taux?: number;
  prix_tva?: number;
  prix_ttc: number;
  iban?: string | null;
  bic?: string | null;
  banque?: string | null;
  /** Si fourni, charge la mention légale (override profil > défaut global) et le mode fiscal. */
  client_user_id?: string | null;
  /** Force le mode TVA exonérée et ignore la ligne TVA. */
  tva_exempt?: boolean;
  /** Texte de la note d'exonération à imprimer si tva_exempt. */
  tva_exemption_note?: string | null;
  /** Mention légale brute à imprimer en pied (overrides resolver si défini). */
  legal_mention?: string | null;
  /** Référence externe imposée par le client (n° BC, n° dossier, n° commande…). Imprimée dans le bloc infos. */
  reference_client?: string | null;
  /** Libellé personnalisé pour la référence externe (défaut : "Référence client"). */
  reference_label?: string | null;
  /** Récapitulatif du devis d'origine (options, suppléments) — repris tel quel sur la facture. */
  devis_message?: string | null;
  /** Options facturées (reprises du devis). */
  options?: string[] | null;
  /** Suppléments chiffrés repris du devis (montants TTC). */
  supplements?: Array<{ label: string; montant: number }> | null;
}




const NAVY: [number, number, number] = [14, 26, 53];
const GOLD: [number, number, number] = [176, 134, 42];
const GOLD_SOFT: [number, number, number] = [212, 175, 55];
const TEXT: [number, number, number] = [32, 38, 52];
const MUTED: [number, number, number] = [122, 130, 145];
const LINE: [number, number, number] = [214, 219, 228];
const SOFT_BG: [number, number, number] = [244, 246, 250];
const WHITE: [number, number, number] = [255, 255, 255];
const GREEN: [number, number, number] = [22, 143, 92];

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

const eur = (n: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} €`;
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch { return d; }
};
const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });
  } catch { return d; }
};

const M = 18; // marge gauche/droite

export async function generateFacturePdf(fInput: FactureData, company?: CompanyInfo | null): Promise<Blob> {
  const co = company ?? (await fetchCompanyInfo().catch(() => null));

  // Facturation au nom de l'organisation (rétroactif) : la société prime sur le contact.
  const billing = await resolveClientBillingIdentity({
    userId: fInput.client_user_id ?? null,
    email: fInput.client_email ?? null,
  });
  const f: FactureData = billing?.societe
    ? {
        ...fInput,
        client_societe: fInput.client_societe || billing.societe,
        client_siret: fInput.client_siret || billing.siret,
        client_tva: fInput.client_tva || billing.tva,
        client_adresse: fInput.client_adresse || billing.adresse,
        client_logo_url: fInput.client_logo_url || billing.logo_url,
      }
    : fInput;

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  applyLigneoFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const innerW = pageW - M * 2;
  const logoData = await loadImageAsDataUrl(logoLigneo);
  const signatureData = await loadImageAsDataUrl(signatureGo);
  // Logo du client (comme sur le devis) — affiché dans le bloc « Facturé à ».
  const clientLogoData = f.client_logo_url ? await loadImageAsDataUrl(f.client_logo_url) : null;

  const resolved = await resolveInvoiceMention({ userId: f.client_user_id ?? null });
  const tvaExempt = f.tva_exempt ?? resolved.pricingDisplayMode === "exempt";
  const exemptionNote = f.tva_exemption_note ?? resolved.tvaExemptionNote ?? "TVA non applicable, art. 293 B du CGI";
  const legalMention = (f.legal_mention ?? (resolved.active ? resolved.mention : null))?.trim() || null;

  const isB2B = f.type_facture === "b2b";
  const isPaid = f.statut === "payee" || !!f.date_paiement;
  const isPlateau = /plateau|porte-voiture/i.test(f.designation ?? "");
  const tvaTaux = tvaExempt ? 0 : (f.tva_taux ?? 20);
  // En franchise en base (micro), le montant net à payer est le prix affiché au client.
  const ht = tvaExempt ? Number(f.prix_ttc ?? f.prix_ht) : Number(f.prix_ht);
  const tva = tvaExempt ? 0 : Number(f.prix_tva ?? +(ht * tvaTaux / 100).toFixed(2));
  const ttc = tvaExempt ? ht : Number(f.prix_ttc);

  // ---- Détail repris du devis d'origine (mêmes libellés, mêmes prix) ----
  let devisMessage = f.devis_message ?? null;
  if (!devisMessage && f.reference_client && /^DEV-/i.test(f.reference_client)) {
    try {
      const { data } = await supabase
        .from("devis")
        .select("message")
        .eq("numero", f.reference_client)
        .maybeSingle();
      devisMessage = (data as { message?: string | null } | null)?.message ?? null;
    } catch { /* détail optionnel */ }
  }
  const parsedSupp = parseDevisSupplements(devisMessage);
  const parsedOpts = parseDevisOptions(devisMessage);
  const supplements = (f.supplements?.length ? f.supplements : parsedSupp.supplements).filter(
    (s) => s && Number(s.montant) > 0,
  );
  const optionsList = (f.options?.length ? f.options : parsedOpts.options).filter(Boolean);
  const toHt = (v: number) => (tvaExempt ? v : +(v / (1 + tvaTaux / 100)).toFixed(2));
  const supplementsTtc = supplements.reduce((s, x) => s + Number(x.montant), 0);
  const baseHt = Math.max(0, +(ht - toHt(supplementsTtc)).toFixed(2));




  // =====================================================================
  //  Modèle officiel « facture-modele-transports-ligneo » (fond clair)
  // =====================================================================
  const INK: [number, number, number] = [11, 16, 32];
  const BLUE: [number, number, number] = [47, 95, 255];
  const GREY: [number, number, number] = [122, 130, 145];
  const BOX: [number, number, number] = [244, 246, 250];
  const RULE: [number, number, number] = [226, 231, 240];
  const BLUEBOX: [number, number, number] = [238, 243, 255];

  const L = M;
  const R = pageW - M;

  // ---------- En-tête ----------
  if (logoData) {
    try { doc.addImage(logoData, "PNG", L, 21, 11, 11); } catch { /* logo optionnel */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  const brand = (co?.raison_sociale || "Transports Ligneo").toUpperCase();
  const brandWords = brand.split(" ");
  const lastWord = brandWords.length > 1 ? brandWords.pop()! : "";
  const firstPart = brandWords.join(" ") + (lastWord ? " " : "");
  doc.text(firstPart, L + 14, 27);
  if (lastWord) {
    doc.setTextColor(...BLUE);
    doc.text(lastWord, L + 14 + doc.getTextWidth(firstPart), 27);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text(`Convoyage automobile${isB2B ? " B2B" : ""} · Tours (37)`, L + 14, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text("FACTURE", R, 21, { align: "right" });
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  doc.text(f.numero, R, 27.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text(`Émise le ${fmtDate(f.date_facture || new Date().toISOString())}`, R, 32.5, { align: "right" });

  // Pastille statut
  {
    const label = isPaid
      ? `PAYÉE${f.paid_at || f.date_paiement ? ` LE ${new Date((f.paid_at || f.date_paiement)!).toLocaleDateString("fr-FR")}` : ""}`
      : "À RÉGLER";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const w = doc.getTextWidth(label) + 12;
    const bx = R - w;
    doc.setFillColor(isPaid ? 232 : 255, isPaid ? 247 : 246, isPaid ? 238 : 230);
    doc.roundedRect(bx, 35.4, w, 6.6, 3.3, 3.3, "F");
    doc.setTextColor(...(isPaid ? GREEN : GOLD));
    doc.text(`\u25CF ${label}`, bx + 6, 39.9);
  }

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(L, 46, R, 46);

  // ---------- Émetteur / Client ----------
  const colW = (innerW - 6) / 2;
  const boxTop = 51.5;
  const boxH2 = 35.5;
  doc.setFillColor(...BOX);
  doc.roundedRect(L, boxTop, colW, boxH2, 2.5, 2.5, "F");
  doc.roundedRect(L + colW + 6, boxTop, colW, boxH2, 2.5, 2.5, "F");

  const smallLabel = (t: string, x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(t, x, y);
  };
  smallLabel("ÉMETTEUR", L + 6, boxTop + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(co?.raison_sociale || "Transports Ligneo", L + 6, boxTop + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  const emitterLines = [
    co?.signataire_nom || null,
    companyAddressLine(co) || "6 rue du Pont Libert, 37520 La Riche",
    toSiren(co?.siret) ? `SIREN : ${toSiren(co?.siret)}` : null,
    [co?.email_contact, co?.telephone].filter(Boolean).join(" · ") || null,

  ].filter(Boolean) as string[];
  let ey = boxTop + 19;
  for (const l of emitterLines) {
    doc.text((doc.splitTextToSize(l, colW - 12) as string[])[0], L + 6, ey);
    ey += 4.6;
  }

  const cX = L + colW + 6;
  smallLabel("CLIENT", cX + 6, boxTop + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  const clientTitle = f.client_societe?.trim() || `${f.client_prenom || ""} ${f.client_nom || ""}`.trim() || "Client";
  doc.text((doc.splitTextToSize(clientTitle, colW - 12) as string[])[0], cX + 6, boxTop + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  const clientDetail: string[] = [];
  if (f.client_adresse) clientDetail.push(...(doc.splitTextToSize(f.client_adresse, colW - 12) as string[]).slice(0, 2));
  if (f.client_siret) clientDetail.push(`N° SIRET : ${f.client_siret}`);
  if (f.client_tva) clientDetail.push(`N° TVA : ${f.client_tva}`);
  if (f.client_email) clientDetail.push(f.client_email);
  if (f.reference_client?.trim()) clientDetail.push(`${f.reference_label?.trim() || "Référence dossier"} : ${f.reference_client.trim()}`);
  let cy2 = boxTop + 19;
  for (const l of clientDetail.slice(0, 4)) {
    doc.text((doc.splitTextToSize(l, colW - 12) as string[])[0], cX + 6, cy2);
    cy2 += 4.6;
  }
  if (clientLogoData) {
    try { doc.addImage(clientLogoData, "PNG", cX + colW - 20, boxTop + 4, 14, 14); } catch { /* optionnel */ }
  }

  // ---------- Mission facturée ----------
  const AMBER: [number, number, number] = [176, 106, 12];
  const AMBER_SOFT: [number, number, number] = [255, 243, 224];
  const BLUE_SOFT: [number, number, number] = [232, 240, 255];
  const pill = (
    x: number,
    y: number,
    text: string,
    bg: [number, number, number],
    ink: [number, number, number],
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    const w = doc.getTextWidth(text) + 5.2;
    const h = 4.6;
    doc.setFillColor(...bg);
    doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
    doc.setTextColor(...ink);
    doc.text(text, x + 2.6, y + 3.2);
  };

  const vehLabel = [f.vehicule_marque, f.vehicule_modele].filter(Boolean).join(" ");
  const plaque = f.vehicule_immatriculation?.trim() || "";
  const hasVeh = Boolean(vehLabel || plaque || f.vehicule_vin || f.distance_km || f.km_depart);
  smallLabel("MISSION FACTURÉE", L, 93.5);
  const mTop = 96.5;
  // Adresses complètes (jusqu'à 3 lignes chacune) — plus de troncature.
  const halfW = innerW * 0.42;
  const departLines = (doc.setFont("helvetica", "bold"), doc.setFontSize(9),
    (doc.splitTextToSize(f.depart || "—", halfW) as string[]).slice(0, 3));
  const arriveeLines = (doc.splitTextToSize(f.arrivee || "—", halfW) as string[]).slice(0, 3);
  const addrRows = Math.max(departLines.length, arriveeLines.length);
  const addrBlockH = 11 + addrRows * 4.4;
  const mH = addrBlockH + (hasVeh ? 20 : 3);
  doc.setFillColor(...BOX);
  doc.roundedRect(L, mTop, innerW, mH, 2.5, 2.5, "F");

  pill(L + 6, mTop + 4, "ENLÈVEMENT", BLUE_SOFT, BLUE);
  pill(L + innerW * 0.5, mTop + 4, "LIVRAISON", AMBER_SOFT, AMBER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  departLines.forEach((l, i) => doc.text(l, L + 6, mTop + 14 + i * 4.4));
  doc.setTextColor(...GREY);
  doc.text("\u2192", L + innerW * 0.465, mTop + 14);
  doc.setTextColor(...INK);
  arriveeLines.forEach((l, i) => doc.text(l, L + innerW * 0.5, mTop + 14 + i * 4.4));

  const missionRef = f.reference_client?.trim() && /^MIS-/i.test(f.reference_client) ? f.reference_client : f.numero.replace(/^FAC-/, "MIS-");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLUE);
  doc.text(missionRef, R - 6, mTop + 7.2, { align: "right" });

  if (hasVeh) {
    const vTop = mTop + addrBlockH;
    doc.setDrawColor(...RULE);
    doc.line(L + 6, vTop, R - 6, vTop);
    smallLabel("VÉHICULE", L + 6, vTop + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    let vx = L + 6;
    if (vehLabel) {
      doc.text(vehLabel, vx, vTop + 11.5);
      vx += doc.getTextWidth(vehLabel) + 3.5;
    }
    if (plaque) vx += drawPlateTag(doc, vx, vTop + 6.3, plaque, 8) + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREY);
    const extras: string[] = [];
    if (f.vehicule_vin) extras.push(`VIN ${f.vehicule_vin}`);
    if (f.km_depart != null) extras.push(`Km départ ${f.km_depart.toLocaleString("fr-FR")}`);
    if (f.km_arrivee != null) extras.push(`Km arrivée ${f.km_arrivee.toLocaleString("fr-FR")}`);
    if (f.distance_km) extras.push(`Distance ${Math.round(f.distance_km)} km`);
    extras.push(isPlateau ? "Transport sur plateau porte-voiture" : "Convoyage par la route");
    doc.text((doc.splitTextToSize(extras.join("  ·  "), innerW - 12) as string[])[0], L + 6, vTop + 16);
    void vx;
  }


  // ---------- Prestation ----------
  let y = mTop + mH + 8;
  // Les factures détaillées (comme la 109) doivent rester sur une seule page A4.
  const compactDetails = supplements.length + optionsList.length >= 4;

  smallLabel("PRESTATION", L, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.text("MONTANT HT", R, y, { align: "right" });
  y += 3;
  doc.setDrawColor(...RULE);
  doc.line(L, y, R, y);
  y += compactDetails ? 5 : 8;

  const mainTitle = f.designation?.trim()
    || (isPlateau ? "Transport sur plateau porte-voiture" : "Convoyage automobile");
  const mainSub = isPlateau
    ? `${f.depart ?? ""} → ${f.arrivee ?? ""}${f.distance_km ? `, environ ${Math.round(f.distance_km)} km` : ""} — véhicule non roulant transporté sur plateau porte-voiture (non conduit).`
    : `${f.depart ?? ""} → ${f.arrivee ?? ""}${f.distance_km ? `, environ ${Math.round(f.distance_km)} km` : ""}. Carburant, péages et assurance tous risques inclus.`;

  const line = (title: string, sub: string, amount: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(compactDetails ? 8.8 : 10.5);
    doc.setTextColor(...INK);
    doc.text((doc.splitTextToSize(title, innerW - 45) as string[])[0], L, y);
    doc.setFont("helvetica", "bold");
    doc.text(amount, R, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(compactDetails ? 7 : 8.5);
    doc.setTextColor(...GREY);
    const subLines = sub ? (doc.splitTextToSize(sub, innerW - 45) as string[]).slice(0, 2) : [];
    const subOffset = compactDetails ? 3.2 : 4.8;
    const subLeading = compactDetails ? 2.7 : 4.2;
    if (subLines.length) doc.text(subLines, L, y + subOffset);
    y += compactDetails
      ? (subLines.length ? subOffset + subLines.length * subLeading + 1 : 2)
      : (subLines.length ? subOffset + subLines.length * subLeading : 2) + 3;
    doc.setDrawColor(...RULE);
    doc.line(L, y, R, y);
    y += compactDetails ? 2.8 : 7;

  };

  // Détail strictement identique au devis : mêmes libellés, mêmes montants.
  line(mainTitle, mainSub, eur(baseHt));
  supplements.forEach((s) => line(s.label, "", eur(toHt(Number(s.montant)))));
  optionsList.forEach((o) => line(`Option : ${o}`, "", "Inclus"));
  line(
    "État des lieux numérique et suivi de mission",
    "Photos horodatées et signature électronique au départ et à l'arrivée, suivi GPS et notifications client.",
    "Inclus",
  );


  // ---------- Totaux ----------
  const totLabelX = L + innerW * 0.55;
  y += compactDetails ? 0 : 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(compactDetails ? 8.5 : 10);
  doc.setTextColor(...GREY);
  doc.text(tvaExempt ? "Total" : "Total HT", totLabelX, y);
  doc.setTextColor(...INK);
  doc.text(eur(ht), R, y, { align: "right" });
  y += compactDetails ? 4.5 : 6;
  doc.setTextColor(...GREY);
  doc.text("TVA", totLabelX, y);
  doc.setTextColor(...INK);
  doc.text(tvaExempt ? "Non applicable" : `${eur(tva)} (${tvaTaux} %)`, R, y, { align: "right" });
  y += compactDetails ? 3 : 4;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(totLabelX, y, R, y);
  doc.setLineWidth(0.3);
  y += compactDetails ? 5.5 : 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compactDetails ? 11 : 13);
  doc.setTextColor(...INK);
  doc.text("Net à payer", totLabelX, y);
  doc.setTextColor(...(isPaid ? GREEN : INK));
  doc.setFontSize(compactDetails ? 12 : 14);
  doc.text(eur(ttc), R, y, { align: "right" });
  y += compactDetails ? 5.5 : 8;

  // ---------- Bandeau règlement ----------
  const rightTxt = isPaid
    ? `\u2713 Réglé${f.paid_at ? ` le ${fmtDateTime(f.paid_at)}` : f.date_paiement ? ` le ${fmtDate(f.date_paiement)}` : ""} — aucun montant restant dû`
    : `\u25CF Montant restant dû : ${eur(ttc)}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const rightW = doc.getTextWidth(rightTxt);
  doc.setFillColor(...BLUEBOX);
  const paymentBoxH = compactDetails ? 9 : 11;
  const paymentTextY = y + (compactDetails ? 5.8 : 7);
  doc.roundedRect(L, y, innerW, paymentBoxH, 2.5, 2.5, "F");
  doc.setFontSize(compactDetails ? 7.5 : 9);
  doc.setTextColor(...INK);
  const modeTxt = f.mode_paiement || (isB2B ? "Virement bancaire" : "Carte bancaire / virement");
  const echeanceTxt = f.date_echeance ? fmtDate(f.date_echeance) : (isB2B ? (f.conditions_paiement || "30 jours fin de mois") : "À réception");
  const reglement = isPaid ? `Mode de règlement : ${modeTxt}` : `Mode de règlement : ${modeTxt} · Échéance : ${echeanceTxt}`;
  doc.text((doc.splitTextToSize(reglement, innerW - rightW - 16) as string[])[0], L + 6, paymentTextY);
  doc.setFontSize(compactDetails ? 7.2 : 8.5);
  doc.setTextColor(...(isPaid ? GREEN : BLUE));
  doc.text(rightTxt, R - 6, paymentTextY, { align: "right" });
  y += paymentBoxH + (compactDetails ? 1.5 : 2);


  if (isB2B) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREY);
    doc.text(`IBAN : ${f.iban || co?.iban || "—"}  ·  BIC : ${f.bic || co?.bic || "—"}`, L, y);
    y += 8;
  }

  // ---------- Mentions légales ----------
  const mentions: string[] = [];
  if (tvaExempt && exemptionNote) mentions.push(exemptionNote);
  mentions.push("En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement (articles L441-10 et D441-5 du Code de commerce).");
  mentions.push("Pas d'escompte pour paiement anticipé. Facture émise en un exemplaire, à conserver.");
  if (legalMention) mentions.push(legalMention);

  doc.setFont("helvetica", "normal");
  const mentionFontSize = compactDetails ? 5.8 : 8;
  const mentionLeading = compactDetails ? 2.6 : 3.8;
  const mentionGap = compactDetails ? 0.4 : 2;
  doc.setFontSize(mentionFontSize);
  const mentionWrapped = mentions.map((m) => doc.splitTextToSize(m, innerW - 12) as string[]);
  const mentionsH = (compactDetails ? 8 : 9.5)
    + mentionWrapped.reduce((s, l) => s + l.length * mentionLeading + mentionGap, 0);
  doc.setFillColor(...BOX);
  doc.roundedRect(L, y, innerW, mentionsH, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compactDetails ? 6 : 7);
  doc.setTextColor(...GREY);
  doc.text("MENTIONS LÉGALES", L + 6, y + (compactDetails ? 5.2 : 7));
  let my = y + (compactDetails ? 8.5 : 12.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(mentionFontSize);
  doc.setTextColor(80, 88, 104);
  for (const lines of mentionWrapped) {
    doc.text(lines, L + 6, my);
    my += lines.length * mentionLeading + mentionGap;
  }
  y += mentionsH;

  // ---------- Pied de page ----------
  const siren = toSiren(co?.siret);
  const l1 = [
    co?.raison_sociale || "Transports Ligneo",
    co?.rcs ? `RCS ${co.rcs}` : null,
    siren ? `SIREN ${siren}` : null,
    co?.tva_intra ? `TVA ${co.tva_intra}` : null,
  ].filter(Boolean).join(" — ");
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(L, pageH - 21, R, pageH - 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text((doc.splitTextToSize(l1 || "Transports Ligneo · Tours (37)", innerW - 60) as string[])[0], L, pageH - 16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLUE);
    doc.text(co?.site_web || "www.transportsligneo.fr", R, pageH - 16, { align: "right" });
    if (pages > 1) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.text(`${p}/${pages}`, pageW / 2, pageH - 16, { align: "center" });
    }
  }

  void signatureData;
  return doc.output("blob");
}




export function downloadFacturePdf(blob: Blob, numero: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Le suffixe distingue explicitement le document régénéré des anciens PDF
  // déjà présents dans les téléchargements du navigateur/téléphone.
  a.download = `Facture-${numero}-nouveau-modele.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
