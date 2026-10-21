import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const PV_LIVRAISON_VIERGE_URL = "/documents/pv-livraison-vierge.pdf";

export interface PvLivraisonData {
  numero?: string | null;
  donneur?: string | null;
  destinataire?: string | null;
  marque_modele?: string | null;
  immatriculation?: string | null;
  vin?: string | null;
  kilometrage?: string | null;
  carburant?: string | null;
  depart?: string | null;
  arrivee?: string | null;
  date_enlevement?: string | null;
  date_livraison?: string | null;
}

// Coordonnées relevées sur le PDF vierge (A4, mesurées à 144 dpi puis converties en points).
const K = 1 / 2.0003;
const PAGE_H = 842.88;
const at = (px: number, py: number) => ({ x: px * K, y: PAGE_H - py * K });

/** Remplit le PV de livraison vierge avec les informations de la mission (texte posé sur le PDF d'origine, rien n'est modifié d'autre). */
export async function generatePvLivraisonRempli(d: PvLivraisonData): Promise<Blob> {
  const res = await fetch(PV_LIVRAISON_VIERGE_URL);
  if (!res.ok) throw new Error("PV vierge introuvable");
  const pdf = await PDFDocument.load(await res.arrayBuffer());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.05, 0.12, 0.3);
  const put = (txt: string | null | undefined, px: number, py: number, maxPx: number, size = 9) => {
    const t = (txt ?? "").toString().trim();
    if (!t) return;
    let s = size;
    while (s > 6 && font.widthOfTextAtSize(t, s) > maxPx * K) s -= 0.5;
    const { x, y } = at(px, py);
    page.drawText(t, { x, y, size: s, font, color: ink });
  };
  put(d.donneur, 441, 283, 320);
  put(d.destinataire, 800, 283, 320);
  put(d.marque_modele, 84, 404, 310);
  put(d.immatriculation?.toUpperCase(), 492, 428, 190, 13);
  put(d.vin, 792, 404, 310);
  if (d.numero) {
    const { x, y } = at(80, 506);
    page.drawRectangle({ x, y, width: 90 * K, height: 16 * K, color: rgb(0.957, 0.965, 0.99) });
    put(d.numero, 84, 498, 310);
  }
  put(d.kilometrage ? `${d.kilometrage} km` : "", 438, 498, 310);
  put(d.carburant, 792, 498, 310);
  put(d.depart, 84, 616, 490);
  put(d.arrivee, 616, 616, 490);
  put(d.date_enlevement, 84, 672, 490);
  put(d.date_livraison, 616, 672, 490);
  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
