import type { jsPDF } from "jspdf";

/**
 * Plaque d'immatriculation identique au badge `.plate-tag` de l'admin
 * (Missions / Attributions) : pastille claire bordée, barre bleu nuit
 * à gauche, texte bold majuscule avec un léger interlettrage.
 */
const PLATE_INK: [number, number, number] = [16, 26, 61]; // #101a3d
const PLATE_BAR: [number, number, number] = [19, 48, 136]; // #133088
const PLATE_BG: [number, number, number] = [248, 250, 253];
const PLATE_BORDER: [number, number, number] = [200, 207, 226]; // #c8cfe2

/** Largeur d'un texte avec interlettrage manuel. */
export function plateTagWidth(doc: jsPDF, text: string, fs = 8.4): number {
  const prevFont = doc.getFont();
  const prevSize = doc.getFontSize();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs);
  const label = text.toUpperCase();
  const track = fs * 0.042; // ≈ .12em
  const textW = doc.getTextWidth(label) + track * Math.max(0, label.length - 1);
  doc.setFont(prevFont.fontName, prevFont.fontStyle);
  doc.setFontSize(prevSize);
  return textW + 2.6 * 2 + 2.4 + 1.2;
}

/**
 * Dessine la plaque. `y` = haut du badge. Retourne la largeur occupée.
 */
export function drawPlateTag(doc: jsPDF, x: number, y: number, text: string, fs = 8.4): number {
  const label = (text || "").toUpperCase();
  if (!label) return 0;
  const prevFont = doc.getFont();
  const prevSize = doc.getFontSize();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs);
  const track = fs * 0.042;
  const padX = 2.6;
  const barW = 2.4;
  const textW = doc.getTextWidth(label) + track * Math.max(0, label.length - 1);
  const w = textW + padX * 2 + barW + 1.2;
  const h = fs * 0.62 + 3.4;
  const r = 1.2;

  doc.setFillColor(...PLATE_BG);
  doc.setDrawColor(...PLATE_BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, r, r, "FD");

  // Bande bleu nuit à gauche (coins arrondis côté gauche uniquement)
  doc.setFillColor(...PLATE_BAR);
  doc.roundedRect(x, y, barW, h, r, r, "F");
  doc.rect(x + r, y, barW - r, h, "F");

  // Texte avec interlettrage
  doc.setTextColor(...PLATE_INK);
  const baseline = y + h / 2 + fs * 0.3;
  let cx = x + barW + padX + 0.4;
  for (const ch of label) {
    doc.text(ch, cx, baseline);
    cx += doc.getTextWidth(ch) + track;
  }

  doc.setFont(prevFont.fontName, prevFont.fontStyle);
  doc.setFontSize(prevSize);
  return w;
}
