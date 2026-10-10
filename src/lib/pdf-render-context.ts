import type jsPDF from "jspdf";
import { DOC_GOLD } from "@/lib/doc-branding";

/** Explicit sandbox rendering: no client records or private billing overrides. */
export interface PdfRenderContext { demo?: boolean }

export function markDemoPdf(doc: jsPDF, context?: PdfRenderContext) {
  if (!context?.demo) return;
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...DOC_GOLD);
    const top = (6 * 72 / 25.4) / doc.internal.scaleFactor;
    doc.text("DÉMONSTRATION — DONNÉES FICTIVES — AUCUNE VALEUR CONTRACTUELLE", doc.internal.pageSize.getWidth() / 2, top, { align: "center" });
  }
}