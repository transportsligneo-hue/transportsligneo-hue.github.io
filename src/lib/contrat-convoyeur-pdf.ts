import jsPDF from "jspdf";
import { LIGNEO_BRAND_LOGO as logoLigneo } from "@/lib/brand-assets";
import { dateFmt, fetchCompanyInfo, loadImageAsDataUrl, type CompanyInfo } from "@/lib/doc-branding";
import { applyLigneoFonts } from "@/lib/pdf-fonts";
import { COMPANY_SIGNATURE_LAYOUT, loadCompanySignature } from "@/lib/pdf-company-signature";
import {
  CONTRAT_NOM,
  buildContratPreambule,
  buildContratSections,
  buildContratSignatureSection,
  type ContratBloc,
  type ContratItem,
} from "@/lib/contrat-convoyeur-content";
import { CONTRAT_BOX_X_RIGHT_MM, CONTRAT_BOX_Y_MM } from "@/lib/contrat-signature-field";

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

type RGB = [number, number, number];
const NAVY: RGB = [6, 18, 56];
const BLUE: RGB = [52, 84, 140];
const INK: RGB = [17, 24, 44];
const TEXT: RGB = [50, 60, 82];
const MUTED: RGB = [128, 134, 148];
const LINE: RGB = [223, 228, 238];
const PANEL: RGB = [246, 248, 252];

const L = 23;
const W = 164;
const R = L + W;
const BOTTOM = 278;
const BODY = 9.2;
const LH = 5;

let lastContratPageCount = 1;
export function getLastContratPageCount() {
  return lastContratPageCount;
}

export async function generateContratConvoyeurPdf(
  d: ContratConvoyeurData,
  company?: CompanyInfo | null,
): Promise<Blob> {
  const c = company ?? (await fetchCompanyInfo());
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  applyLigneoFonts(doc);
  const logo = await loadImageAsDataUrl(logoLigneo);
  const sig = await loadCompanySignature();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 0;

  const set = (size: number, bold = false, color: RGB = TEXT) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const miniHeader = () => {
    if (logo) {
      try { doc.addImage(logo, "PNG", L, 10, 7, 7, "logo-ligneo-contrat", "FAST"); } catch { /* logo optionnel */ }
    }
    set(7.2, true, MUTED);
    doc.text("CONTRAT-CADRE DE CONVOYAGE", R, 15, { align: "right", charSpace: 0.4 });
    doc.setFillColor(...NAVY);
    doc.rect(L, 19.2, W, 0.8, "F");
    y = 30;
  };
  const newPage = () => { doc.addPage(); miniHeader(); };
  const ensure = (need: number) => { if (y + need > BOTTOM) newPage(); };

  /** Paragraphe justifié (dernière ligne alignée à gauche). */
  const para = (text: string, x = L, w = W, after = 2.6) => {
    set(BODY);
    const lines = doc.splitTextToSize(text, w) as string[];
    lines.forEach((ln, i) => {
      ensure(LH);
      if (i < lines.length - 1 && ln.includes(" ")) doc.text(ln, x, y, { maxWidth: w, align: "justify" });
      else doc.text(ln, x, y);
      y += LH;
    });
    y += after;
  };

  const bullet = (item: ContratItem) => {
    const txt = typeof item === "string" ? item : item.t;
    set(BODY);
    const lines = doc.splitTextToSize(txt, W - 8) as string[];
    ensure(LH * Math.min(lines.length, 2));
    doc.setFillColor(...BLUE);
    doc.rect(L + 1.6, y - 2, 1.6, 1.6, "F");
    set(BODY);
    lines.forEach((ln, i) => {
      ensure(LH);
      if (i < lines.length - 1 && ln.includes(" ")) doc.text(ln, L + 8, y, { maxWidth: W - 8, align: "justify" });
      else doc.text(ln, L + 8, y);
      y += LH;
    });
    if (typeof item !== "string") {
      item.sub.forEach((s) => {
        const sl = doc.splitTextToSize(s, W - 16) as string[];
        ensure(LH);
        doc.setTextColor(...MUTED);
        doc.text("–", L + 9, y);
        set(BODY);
        sl.forEach((ln) => { ensure(LH); doc.text(ln, L + 15, y); y += LH; });
      });
    }
    y += 0.9;
  };

  const h3 = (ref: string, title: string) => {
    ensure(20);
    y += 3;
    doc.setFillColor(...BLUE);
    doc.rect(L, y - 3.6, 1, 4.6, "F");
    set(9.4, true, INK);
    doc.text(title, L + 4, y);
    set(8, false, MUTED);
    doc.text(ref, R, y, { align: "right" });
    y += 6;
  };

  const sectionTitle = (letter: string, title: string) => {
    ensure(34);
    y += 9;
    doc.setFillColor(...NAVY);
    doc.roundedRect(L, y - 7, 10, 10, 2, 2, "F");
    set(12, true, [255, 255, 255]);
    doc.text(letter, L + 5, y - 0.2, { align: "center" });
    set(12.5, true, INK);
    doc.text(title, L + 15, y);
    y += 10;
  };

  const blocs = (list: ContratBloc[]) => {
    list.forEach((b) => {
      if ("h3" in b) h3(b.ref, b.h3);
      else if ("p" in b) para(b.p);
      else { b.ul.forEach(bullet); y += 1.2; }
    });
  };

  /* ---------------- Page 1 ---------------- */
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 64, "F");
  doc.setFillColor(...BLUE);
  doc.rect(0, 64, 210, 1.6, "F");
  if (logo) {
    try { doc.addImage(logo, "PNG", L, 16, 24, 24, "logo-ligneo-contrat", "FAST"); } catch { /* logo optionnel */ }
  }
  set(19, true, [255, 255, 255]);
  doc.text(CONTRAT_NOM, L + 32, 27);
  set(8.4, false, [190, 202, 226]);
  doc.text("Convoyage et logistique automobile", L + 32, 33.5);
  doc.text("Particuliers et professionnels · Tours (37)", L + 32, 38.5);

  set(7.4, true, BLUE);
  doc.text("DOCUMENT CONTRACTUEL", L, 82, { charSpace: 0.7 });
  set(23, true, INK);
  ["CONTRAT-CADRE", "DE CONVOYAGE PROFESSIONNEL"].forEach((t, i) => doc.text(t, L, 94 + i * 10));
  set(10, false, MUTED);
  doc.text("Conducteur indépendant · Mission à la demande", L, 117);
  doc.setFillColor(...NAVY);
  doc.rect(L, 121, 18, 1.2, "F");

  y = 134;
  set(7.8, true, BLUE);
  doc.text("ENTRE LES SOUSSIGNÉS", L, y, { charSpace: 0.5 });
  y += 6;
  const pre = buildContratPreambule(c);
  para(pre.entre.replace(/\*\*/g, ""));
  para(`ci-après désignée « ${CONTRAT_NOM} »,`);
  para("D'une part,");

  set(7.8, true, BLUE);
  y += 2;
  doc.text("ET", L, y);
  y += 4;

  const vierge = /[….]{3}/.test(d.nom_complet);
  const dots = "………………………………………";
  const presta =
    `M / Mme ${d.nom_complet}, entrepreneur individuel ou gérant, inscrit au répertoire SIRENE ou société immatriculée au Registre du Commerce et des Sociétés sous le numéro ${d.siret || dots}, ` +
    `domicilié(e) ${d.adresse ? "à " + d.adresse : "à " + dots}` +
    `${d.permis_numero ? `, titulaire du permis de conduire de catégorie B n° ${d.permis_numero}${d.permis_date ? ` (délivré le ${d.permis_date})` : ""}` : ""}.`;
  set(BODY);
  const pl = doc.splitTextToSize(presta, W - 12) as string[];
  const boxH = 6 + pl.length * LH + 12;
  doc.setFillColor(...PANEL);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.rect(L, y, W, boxH, "FD");
  doc.setFillColor(...BLUE);
  doc.rect(L, y, 1.3, boxH, "F");
  let by = y + 7;
  pl.forEach((ln, i) => {
    set(BODY);
    if (i < pl.length - 1 && ln.includes(" ")) doc.text(ln, L + 6, by, { maxWidth: W - 12, align: "justify" });
    else doc.text(ln, L + 6, by);
    by += LH;
  });
  set(8.6, false, MUTED);
  doc.text("ci-après dénommé(e) « le PRESTATAIRE »", L + 6, by);
  doc.text("D'autre part,", L + 6, by + 5);
  y += boxH + 6;

  para("Les soussignés étant ci-après dénommés ensemble les « Parties » ou individuellement une « Partie ».", L, W, 5);

  set(10, true, INK);
  doc.text("EXPOSÉ PRÉALABLE", L, y);
  y += 7;
  pre.rappel.forEach((t) => para(t));
  pre.droits.forEach(bullet);
  y += 1;
  set(10, true, INK);
  ensure(10);
  doc.text("LES PARTIES CONVIENNENT DE CE QUI SUIT", L, y);
  y += 3;

  /* ---------------- Articles A → R ---------------- */
  buildContratSections(c).forEach((s) => {
    sectionTitle(s.id, s.title);
    blocs(s.blocs);
  });

  /* ---------------- S — Signature (page dédiée) ---------------- */
  newPage();
  const sg = buildContratSignatureSection();
  y = 29;
  doc.setFillColor(...NAVY);
  doc.roundedRect(L, y - 7, 10, 10, 2, 2, "F");
  set(12, true, [255, 255, 255]);
  doc.text("S", L + 5, y - 0.2, { align: "center" });
  set(12.5, true, INK);
  doc.text(sg.title, L + 15, y);
  y += 12;
  sg.paragraphes.forEach((t) => para(t, L, W, 3.4));
  y += 2;
  set(BODY);
  const dateTxt = vierge ? "" : dateFmt(d.signed_at || new Date().toISOString());
  const fait = "Fait en un (1) exemplaire original, le ";
  doc.text(fait, L, y);
  const fx = L + doc.getTextWidth(fait);
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(fx, y + 0.8, fx + 34, y + 0.8);
  if (dateTxt) { set(BODY, true, INK); doc.text(dateTxt, fx + 1, y - 0.3); }

  const bw = 79.5;
  const bh = 56;
  const by0 = CONTRAT_BOX_Y_MM;
  const boxes: Array<[number, "ligneo" | "presta"]> = [[L, "ligneo"], [CONTRAT_BOX_X_RIGHT_MM, "presta"]];
  boxes.forEach(([bx, who]) => {
    doc.setFillColor(...PANEL);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.rect(bx, by0, bw, bh, "FD");
    set(7.4, true, BLUE);
    doc.text(who === "ligneo" ? `POUR ${CONTRAT_NOM}` : "POUR LE PRESTATAIRE", bx + 5, by0 + 7.5, { charSpace: 0.4 });
    set(7, false, [185, 191, 204]);
    doc.text("Signature", bx + 5, by0 + 49);
  });

  // Signataire Transports Ligneo + signature et tampon (même composition que les factures, en plus grand)
  const signataire = c?.signataire_nom || "Olivier Gourlaouen";
  const fonction = c?.signataire_fonction || "Fondateur";
  set(10.2, true, INK);
  doc.text(`Monsieur ${signataire}`, L + 5, by0 + 14.5);
  set(7.8, false, MUTED);
  doc.text(fonction, L + 5, by0 + 19.2);
  const k = 1.45; // tampon
  const sigH = 44; // signature agrandie, à ses vraies proportions, pour ressortir comme sur le contrat de référence
  const sigW = (sigH * 894) / 672;
  const lay = COMPANY_SIGNATURE_LAYOUT;
  const sx = L + 8;
  const sy = by0 + 31;
  if (sig.stampData) doc.addImage(sig.stampData, "PNG", sx, sy, lay.stampWidth * k, lay.stampHeight * k, "tampon-ligneo-contrat", "FAST", lay.rotation);
  if (sig.signatureData) doc.addImage(sig.signatureData, "PNG", L + 14, by0 + 11, sigW, sigH, "signature-ligneo-contrat", "FAST");

  // Encadré du PRESTATAIRE
  const rx = CONTRAT_BOX_X_RIGHT_MM + 5;
  set(10.2, true, INK);
  doc.text(vierge ? dots.slice(0, 22) : d.nom_complet, rx, by0 + 14.5, { maxWidth: bw - 10 });
  if (d.signed_at) {
    set(7.8, true, NAVY);
    doc.text("Signé électroniquement — lu et approuvé", rx, by0 + 36);
    set(6.8, false, MUTED);
    doc.text(`Nom saisi : ${d.signature_nom || d.nom_complet}`, rx, by0 + 40.5);
    doc.text(`Horodatage : ${new Date(d.signed_at).toLocaleString("fr-FR")}${d.signature_ip ? ` — IP ${d.signature_ip}` : ""}`, rx, by0 + 44.5, { maxWidth: bw - 10 });
  }

  /* ---------------- Pieds de page ---------------- */
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...NAVY);
    doc.rect(0, 287, 210, 10, "F");
    set(7.4, true, [255, 255, 255]);
    doc.text("TRANSPORTS LIGNEO", L, 293);
    set(7.4, false, [190, 202, 226]);
    doc.text("Contrat-cadre de convoyage professionnel", L + 38, 293);
    set(7.4, false, MUTED);
    doc.setTextColor(255, 255, 255);
    doc.text(`${p} / ${total}`, R, 293, { align: "right" });
  }
  void pageH;
  lastContratPageCount = total;
  return doc.output("blob");
}
