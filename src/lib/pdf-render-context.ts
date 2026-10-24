import type jsPDF from "jspdf";
import { DOC_GOLD } from "@/lib/doc-branding";
import { supabase } from "@/integrations/supabase/client";

/** Explicit sandbox rendering: no client records or private billing overrides. */
export interface PdfRenderContext { demo?: boolean }

const DEMO_EMAIL = "demo-flotte@transportsligneo.fr";
let sessionIsDemo = false;

// Le compte flotte de démonstration est reconnu automatiquement : tous ses PDF
// (factures, devis, PV…) portent la mention « fictif », sans rien changer aux appels.
if (typeof window !== "undefined") {
  const sync = (email?: string | null) => { sessionIsDemo = (email ?? "").toLowerCase() === DEMO_EMAIL; };
  supabase.auth.getSession().then(({ data }) => sync(data.session?.user?.email)).catch(() => {});
  supabase.auth.onAuthStateChange((_e, session) => sync(session?.user?.email));
}

export function markDemoPdf(doc: jsPDF, context?: PdfRenderContext) {
  if (!context?.demo && !sessionIsDemo) return;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    // Filigrane diagonal, transparent, derrière le regard mais lisible
    try {
      const d = doc as unknown as { GState: new (o: { opacity: number }) => unknown; setGState: (g: unknown) => void; saveGraphicsState: () => void; restoreGraphicsState: () => void };
      d.saveGraphicsState();
      d.setGState(new d.GState({ opacity: 0.10 }));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(78);
      doc.setTextColor(...DOC_GOLD);
      doc.text("SPÉCIMEN", w / 2, h / 2, { align: "center", angle: 35 });
      doc.setFontSize(15);
      doc.text("DOCUMENT FICTIF · DÉMONSTRATION", w / 2 + 6, h / 2 + 24, { align: "center", angle: 35 });
      d.restoreGraphicsState();
    } catch { /* filigrane non bloquant */ }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...DOC_GOLD);
    const top = (6 * 72 / 25.4) / doc.internal.scaleFactor;
    doc.text("SPÉCIMEN — DOCUMENT FICTIF — DONNÉES FICTIVES — AUCUNE VALEUR CONTRACTUELLE", w / 2, top, { align: "center" });
    const bottom = h - (3 * 72 / 25.4) / doc.internal.scaleFactor;
    doc.text("Document généré dans l'espace de démonstration Transports Ligneo : il n'a aucune valeur comptable ni juridique.", w / 2, bottom, { align: "center" });
  }
}
