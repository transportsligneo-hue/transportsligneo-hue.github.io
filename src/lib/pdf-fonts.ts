import type jsPDF from "jspdf";

/**
 * Applique la typographie du site (Space Grotesk) à un document jsPDF.
 * La police est enregistrée sous le nom "helvetica" afin que TOUS les appels
 * existants `doc.setFont("helvetica", ...)` utilisent automatiquement la
 * typographie de la marque, sans casser le code existant.
 */
export function applyLigneoFonts(doc: jsPDF): void {
  try {
    const mod = require("./pdf-font-space-grotesk") as typeof import("./pdf-font-space-grotesk");
    registerFonts(doc, mod.SPACE_GROTESK_REGULAR_B64, mod.SPACE_GROTESK_BOLD_B64);
  } catch {
    /* la police reste celle par défaut */
  }
}

function registerFonts(doc: jsPDF, regular: string, bold: string) {
  const d = doc as unknown as {
    addFileToVFS: (f: string, d: string) => void;
    addFont: (f: string, name: string, style: string) => void;
    setFont: (name: string, style?: string) => void;
  };
  d.addFileToVFS("SpaceGrotesk-Regular.ttf", regular);
  d.addFileToVFS("SpaceGrotesk-Bold.ttf", bold);
  for (const family of ["helvetica", "SpaceGrotesk"]) {
    d.addFont("SpaceGrotesk-Regular.ttf", family, "normal");
    d.addFont("SpaceGrotesk-Regular.ttf", family, "italic");
    d.addFont("SpaceGrotesk-Bold.ttf", family, "bold");
    d.addFont("SpaceGrotesk-Bold.ttf", family, "bolditalic");
  }
  d.setFont("helvetica", "normal");
}
