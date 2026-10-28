import type jsPDF from "jspdf";
import { DOCUMENT_TEMPLATE } from "@/lib/document-template-theme";
import { loadImageAsDataUrl } from "@/lib/doc-branding";

/** Logo « Transports Ligneo DRIVER » (badge carré) : utilisé sur tous les documents destinés aux convoyeurs. */
export const DRIVER_LOGO_PATH = "/icons/logo-driver-app.png";
export const loadDriverLogo = () => loadImageAsDataUrl(DRIVER_LOGO_PATH);

/**
 * En-tête clair, identique à celui des factures et devis clients
 * (logo à gauche, raison sociale, titre du document à droite, filet gris),
 * mais avec le logo Driver.
 */
export function drawDriverDocHeader(
  doc: jsPDF,
  o: { logo: string | null; raisonSociale?: string | null; sousTitre: string; titre: string; numero?: string; ligne?: string; L: number; R: number },
) {
  const INK = DOCUMENT_TEMPLATE.ink as [number, number, number];
  const BLUE = DOCUMENT_TEMPLATE.blue as [number, number, number];
  const GREY = DOCUMENT_TEMPLATE.textSoft as [number, number, number];
  const RULE = DOCUMENT_TEMPLATE.line as [number, number, number];
  if (o.logo) { try { doc.addImage(o.logo, "PNG", o.L, 12, 20, 20, "logo-driver-doc", "FAST"); } catch { /* optionnel */ } }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const words = (o.raisonSociale || "Transports Ligneo").toUpperCase().split(" ");
  const last = words.length > 1 ? words.pop() ?? "" : "";
  const first = words.join(" ") + (last ? " " : "");
  doc.setTextColor(...INK);
  doc.text(first, o.L + 24, 21);
  if (last) { doc.setTextColor(...BLUE); doc.text(last, o.L + 24 + doc.getTextWidth(first), 21); }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text(o.sousTitre, o.L + 24, 26.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(o.numero ? 22 : 15);
  doc.setTextColor(...INK);
  doc.text(o.titre, o.R, o.numero ? 21 : 20, { align: "right" });
  if (o.numero) {
    doc.setFontSize(12);
    doc.setTextColor(...BLUE);
    doc.text(o.numero, o.R, 27.5, { align: "right" });
  }
  if (o.ligne) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREY);
    doc.text(o.ligne, o.R, o.numero ? 32.5 : 26.5, { align: "right" });
  }
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(o.L, 38, o.R, 38);
  doc.setFillColor(...BLUE);
  doc.rect(o.L, 37.5, 40, 1, "F");
  doc.setFillColor(0, 170, 255);
  doc.rect(o.L + 40, 37.5, 22, 1, "F");
}
