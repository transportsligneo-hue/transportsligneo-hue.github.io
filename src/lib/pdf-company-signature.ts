import type jsPDF from "jspdf";
import signature from "@/assets/signature-go-transparente.png";
import stamp from "@/assets/tampon-ligneo.png";
import { loadImageAsDataUrl } from "@/lib/doc-branding";

/** Invoice-approved composition, in millimetres, independent of PDF units. */
export const COMPANY_SIGNATURE_LAYOUT = {
  stampWidth: 40,
  stampHeight: 40 * 442 / 1200,
  rotation: 3,
  signatureOffsetX: 16,
  signatureOffsetY: 3.6,
  signatureWidth: 30,
  signatureHeight: 12,
} as const;

export async function loadCompanySignature() {
  const [stampData, signatureData] = await Promise.all([
    loadImageAsDataUrl(stamp), loadImageAsDataUrl(signature),
  ]);
  return { stampData, signatureData };
}

/** x/y use document units; physical size and overlay stay identical. */
export function drawCompanySignature(doc: jsPDF, assets: Awaited<ReturnType<typeof loadCompanySignature>>, x: number, y: number) {
  const unit = (72 / 25.4) / doc.internal.scaleFactor;
  const l = COMPANY_SIGNATURE_LAYOUT;
  if (assets.stampData) doc.addImage(assets.stampData, "PNG", x, y,
    l.stampWidth * unit, l.stampHeight * unit, "tampon-ligneo-net", "NONE", l.rotation);
  if (assets.signatureData) doc.addImage(assets.signatureData, "PNG",
    x + l.signatureOffsetX * unit, y + l.signatureOffsetY * unit,
    l.signatureWidth * unit, l.signatureHeight * unit);
}