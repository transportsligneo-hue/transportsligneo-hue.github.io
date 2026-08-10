import jsPDF from "jspdf";
// Logo officiel carré 1:1 — évite l'écrasement subi par logo-ligneo.png (ratio 2.65)
import { LIGNEO_BRAND_LOGO as logoLigneo } from "@/lib/brand-assets";
import signatureGo from "@/assets/signature-go.png";
import { resolveInvoiceMention } from "@/lib/invoice-settings";
import {
  fetchCompanyInfo,
  companyLegalLine1,
  companyLegalLine2,
  resolveClientBillingIdentity,
  type CompanyInfo,
} from "@/lib/doc-branding";
import { applyLigneoFonts } from "@/lib/pdf-fonts";



export interface FactureData {
  numero: string;
  type_facture: "particulier" | "b2b";
  statut?: string;
  date_facture?: string;
  date_mission?: string | null;
  date_echeance?: string | null;
  date_paiement?: string | null;
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
  const tvaTaux = tvaExempt ? 0 : (f.tva_taux ?? 20);
  // En franchise en base (micro), le montant net à payer est le prix affiché au client.
  const ht = tvaExempt ? Number(f.prix_ttc ?? f.prix_ht) : Number(f.prix_ht);
  const tva = tvaExempt ? 0 : Number(f.prix_tva ?? +(ht * tvaTaux / 100).toFixed(2));
  const ttc = tvaExempt ? ht : Number(f.prix_ttc);


  // ===== Bandeau navy =====
  doc.setFillColor(...NAVY);
  doc.rect(M, 12, innerW, 26, "F");
  if (logoData) {
    try { doc.addImage(logoData, "PNG", M + 5, 15, 20, 20); } catch {}
  }
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text((co?.raison_sociale || "TRANSPORTS LIGNEO").toUpperCase(), M + 31, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_SOFT);
  doc.text("CONVOYAGE AUTOMOBILE — FRANCE & EUROPE", M + 31, 30);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(M, 39, pageW - M, 39);

  // ===== Titre + dates =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...NAVY);
  doc.text(isB2B ? "FACTURE B2B" : "FACTURE", M, 54);
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(`N° ${f.numero}`, M, 61);

  const rX = pageW - M;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Date de facturation", rX, 47, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(fmtDate(f.date_facture || new Date().toISOString()), rX, 53, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(isPaid && !isB2B ? "Date de paiement" : "Date d'échéance", rX, 60, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(
    isPaid && !isB2B ? fmtDate(f.date_paiement) : (f.date_echeance ? fmtDate(f.date_echeance) : "À réception"),
    rX, 66, { align: "right" },
  );

  // ===== Facturé à / Références =====
  const blockTop = 70;
  const leftW = innerW * 0.52 - 4;
  const clientLines: { t: string; bold?: boolean; muted?: boolean }[] = [];
  const societe = f.client_societe?.trim();
  const contact = `${f.client_prenom || ""} ${f.client_nom || ""}`.trim();
  if (societe) {
    // Facture au nom de l'entreprise uniquement (pas de nom de contact)
    clientLines.push({ t: societe, bold: true });
  } else if (contact) {
    clientLines.push({ t: contact, bold: true });
  } else {
    clientLines.push({ t: "Client", bold: true });
  }

  if (f.client_adresse) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (const l of doc.splitTextToSize(f.client_adresse, leftW - 12) as string[]) clientLines.push({ t: l });
  }
  if (f.client_siret) clientLines.push({ t: `SIRET ${f.client_siret}`, muted: true });
  if (f.client_tva) clientLines.push({ t: `TVA ${f.client_tva}`, muted: true });
  if (f.client_email) clientLines.push({ t: f.client_email, muted: true });

  const logoBoxW = clientLogoData ? 22 : 0;
  const boxH = Math.max(14 + clientLines.length * 5.0, clientLogoData ? 30 : 0);
  doc.setFillColor(...SOFT_BG);
  doc.rect(M, blockTop, leftW, boxH, "F");
  if (clientLogoData) {
    try { doc.addImage(clientLogoData, "PNG", M + leftW - logoBoxW - 4, blockTop + 4, 18, 18); } catch { /* logo optionnel */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("FACTURÉ À", M + 6, blockTop + 8);
  let cy = blockTop + 16;
  const textMaxW = leftW - 12 - logoBoxW;
  for (const l of clientLines) {
    doc.setFont("helvetica", l.bold ? "bold" : "normal");
    doc.setFontSize(l.bold ? 11 : 9);
    doc.setTextColor(...(l.muted ? MUTED : TEXT));
    const line = (doc.splitTextToSize(l.t, textMaxW) as string[])[0] || l.t;
    doc.text(line, M + 6, cy);
    cy += l.bold ? 6.4 : 5.2;
  }

  // Références (colonne droite)
  const refX = M + innerW * 0.52 + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("RÉFÉRENCES", refX, blockTop + 8);
  const refs: [string, string][] = [];
  if (f.reference_client?.trim()) refs.push([f.reference_label?.trim() || "N° commande", f.reference_client.trim()]);
  if (f.depart && f.arrivee) refs.push(["Trajet", `${f.depart.split(",")[0]} - ${f.arrivee.split(",")[0]}`]);
  const vehLabel = [f.vehicule_marque, f.vehicule_modele].filter(Boolean).join(" ");
  if (vehLabel) refs.push(["Véhicule", `${vehLabel}${f.vehicule_immatriculation ? ` (${f.vehicule_immatriculation})` : ""}`]);
  if (f.date_mission) refs.push(["Livré le", fmtDate(f.date_mission)]);
  refs.push(["Mode de règlement", f.mode_paiement || (isB2B ? "Virement bancaire" : "Carte bancaire")]);
  let ry = blockTop + 16;
  for (const [k, v] of refs) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(`${k} : `, refX, ry);
    const kw = doc.getTextWidth(`${k} : `);
    doc.setFont("helvetica", "bold");
    const val = (doc.splitTextToSize(v, pageW - M - refX - kw) as string[])[0];
    doc.text(val, refX + kw, ry);
    ry += 5.2;
  }

  // ===== Tableau prestation =====
  let y = Math.max(blockTop + boxH, ry) + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("DÉTAIL DE LA PRESTATION", M, y);
  y += 5;

  const colQty = pageW - M - 96;
  const colUnit = pageW - M - 54;
  const colTotal = pageW - M;
  doc.setFillColor(...NAVY);
  doc.rect(M, y, innerW, 9, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.text("Description", M + 5, y + 5.9);
  doc.text("Qté", colQty + 12, y + 5.9, { align: "center" });
  doc.text("Prix unit. HT", colUnit + 20, y + 5.9, { align: "right" });
  doc.text("Total HT", colTotal - 5, y + 5.9, { align: "right" });
  y += 9;

  const distance = f.distance_km ?? 0;
  const mainDesc = [
    f.designation || `Convoyage routier${f.depart && f.arrivee ? ` ${f.depart.split(",")[0]} - ${f.arrivee.split(",")[0]}` : ""}${distance ? ` (${distance} km)` : ""}`,
    "Inclus : carburant, péages, assurance tous risques",
  ].join(" — ");
  const rows: { desc: string; qty: string; unit: string; total: string; free?: boolean }[] = [
    { desc: mainDesc, qty: "1", unit: eur(ht), total: eur(ht) },
    { desc: "État des lieux contradictoire départ / arrivée (constat photo)", qty: "1", unit: "Inclus", total: eur(0), free: true },
    { desc: "Suivi GPS temps réel + notifications client", qty: "1", unit: "Inclus", total: eur(0), free: true },
  ];

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  for (const r of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(r.desc, colQty - M - 8) as string[];
    const rowH = Math.max(9, lines.length * 4.2 + 5);
    doc.setTextColor(...TEXT);
    doc.text(lines, M + 5, y + 6);
    const midY = y + rowH / 2 + 1.4;
    doc.text(r.qty, colQty + 12, midY, { align: "center" });
    doc.setTextColor(...(r.free ? MUTED : TEXT));
    doc.text(r.unit, colUnit + 20, midY, { align: "right" });
    doc.setTextColor(...TEXT);
    doc.text(r.total, colTotal - 5, midY, { align: "right" });
    doc.rect(M, y, innerW, rowH, "S");
    y += rowH;
  }

  // ===== Totaux =====
  y += 7;
  const totLabelX = colUnit + 20;
  const totValX = colTotal - 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(tvaExempt ? "Total" : "Total HT", totLabelX, y, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(eur(ht), totValX, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(tvaExempt ? "TVA" : `TVA (${tvaTaux} %)`, totLabelX, y, { align: "right" });
  doc.text(tvaExempt ? "Non applicable" : eur(tva), totValX, y, { align: "right" });

  y += 4;
  doc.setFillColor(...NAVY);
  doc.rect(colUnit - 30, y, colTotal - (colUnit - 30), 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(tvaExempt ? "TOTAL NET À PAYER" : "TOTAL TTC", totLabelX, y + 7.8, { align: "right" });

  doc.setFontSize(11);
  doc.setTextColor(...GOLD_SOFT);
  doc.text(eur(ttc), totValX, y + 7.8, { align: "right" });
  y += 18;

  // ===== Statut / modalités / signature =====
  const fh = 22;
  const contentBottom = pageH - M - fh - 8;
  const ensure = (need: number) => {
    if (y + need > contentBottom) {
      doc.addPage();
      y = M + 12;
    }
  };

  const modalites: string[] = [];
  if (isB2B) {
    modalites.push(`Paiement à ${f.conditions_paiement || "30 jours fin de mois"} date de facture, par virement bancaire.`);
    modalites.push(`IBAN : ${f.iban || co?.iban || "—"} — BIC : ${f.bic || co?.bic || "—"}`);
  } else if (isPaid) {
    modalites.push(`Facture acquittée — réglée par ${(f.mode_paiement || "carte bancaire").toLowerCase()}${f.date_paiement ? ` le ${fmtDate(f.date_paiement)}` : ""}.`);
  } else {
    modalites.push("Paiement à réception de facture.");
  }
  modalites.push("Retard de paiement : pénalités au taux légal + indemnité forfaitaire de 40 € (art. L441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.");
  if (tvaExempt && exemptionNote) modalites.push(exemptionNote);
  if (legalMention) modalites.push(legalMention);

  const textW = innerW * 0.6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const wrapped = modalites.map((m) => doc.splitTextToSize(`• ${m}`, textW) as string[]);
  const blockH = 11 + wrapped.reduce((s, l) => s + l.length * 3.5 + 0.8, 0);
  ensure(Math.max(blockH, 32));

  const blockY = y;
  // Statut
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text("Statut : ", M, blockY);
  const sw = doc.getTextWidth("Statut : ");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(isPaid ? GREEN : GOLD));
  doc.text(isPaid ? "PAYÉE" : "À RÉGLER", M + sw, blockY);

  // Modalités
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("MODALITÉS DE RÈGLEMENT", M, blockY + 8);
  let my = blockY + 12.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT);
  for (const lines of wrapped) {
    doc.text(lines, M, my);
    my += lines.length * 3.5 + 0.8;
  }

  // Signature (colonne droite)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(`Pour ${co?.raison_sociale || "Transports Ligneo"}`, rX, blockY, { align: "right" });
  if (signatureData) {
    try { doc.addImage(signatureData, "PNG", rX - 32, blockY + 2, 30, 14); } catch {}
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `${co?.signataire_nom || "Olivier G."} — ${co?.signataire_fonction || "Fondateur"}`,
    rX, blockY + 21, { align: "right" },
  );
  y = Math.max(my, blockY + 26);


  // ===== Pied de page navy (toutes les pages) =====
  const l1 = companyLegalLine1(co);
  const l2 = companyLegalLine2(co);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...NAVY);
    doc.rect(M, pageH - M - fh, innerW, fh, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...GOLD_SOFT);
    doc.text((co?.raison_sociale || "TRANSPORTS LIGNEO").toUpperCase(), pageW / 2, pageH - M - fh + 7, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...WHITE);
    if (l1) doc.text((doc.splitTextToSize(l1, innerW - 12) as string[])[0], pageW / 2, pageH - M - fh + 12.5, { align: "center" });
    if (l2) doc.text((doc.splitTextToSize(l2, innerW - 12) as string[])[0], pageW / 2, pageH - M - fh + 17, { align: "center" });
    if (pages > 1) {
      doc.setFontSize(6);
      doc.setTextColor(...GOLD_SOFT);
      doc.text(`${p}/${pages}`, pageW - M - 4, pageH - M - fh + 17, { align: "right" });
    }
  }

  return doc.output("blob");
}



export function downloadFacturePdf(blob: Blob, numero: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Facture-${numero}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
