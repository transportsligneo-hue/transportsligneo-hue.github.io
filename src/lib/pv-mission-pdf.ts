/** Exact supplied blue-neon PV templates; only mission values are overlaid. */
import jsPDF from "jspdf";
import { PDFDocument } from "pdf-lib";
import livraisonTemplate from "@/assets/pv-livraison-template.pdf.asset.json";
import restitutionTemplate from "@/assets/pv-restitution-template.pdf.asset.json";
import { fetchCompanyInfo, toSiren, DOC_TEXT, DOC_GOLD, DOC_MUTED, type CompanyInfo } from "@/lib/doc-branding";
import { applyLigneoFonts } from "@/lib/pdf-fonts";
import { formatVin, normalizeVin } from "@/lib/vin";
import { markDemoPdf, type PdfRenderContext } from "@/lib/pdf-render-context";

export type PvVariant = "livraison" | "restitution";

/** Dommage repris de l'état des lieux de la mission (schéma pré-rempli). */
export interface PvDommage {
  /** Code légende : R, C, E, M, T, I… */
  code: string;
  /** Zone / vue concernée (ex. « Côté gauche »). */
  zone?: string | null;
  /** Commentaire libre du convoyeur. */
  note?: string | null;
}

export interface PvMissionData {
  /** Numéro de mission strictement identique à celui affiché dans l'app. */
  numero_mission: string;
  /** Numéro complet du PV (voir `pvNumero`). */
  numero_pv: string;
  donneur_ordre?: string | null;
  destinataire?: string | null;
  marque_modele?: string | null;
  immatriculation?: string | null;
  vin?: string | null;
  kilometrage_depart?: string | null;
  kilometrage_arrivee?: string | null;
  carburant?: string | null;
  lieu_prise_en_charge?: string | null;
  lieu_livraison?: string | null;
  date_prise_en_charge?: string | null;
  date_livraison?: string | null;
  /** Annotations de dommages issues de l'EDL — schéma vierge si vide. */
  dommages?: PvDommage[];
  /** Véhicule non roulant : bascule sur la version « transport sur plateau ». */
  plateau?: boolean | null;
  /** Transporteur / n° de plateau, si déjà renseigné sur la mission. */
  plateau_numero?: string | null;
  /** Signatures collectées (PNG data URL) : convoyeur + destinataire/propriétaire. */
  signatures?: { convoyeur?: string | null; contrepartie?: string | null };
}


/** Numéro de PV dérivé du numéro de mission (jamais de compteur autonome). */
export function pvNumero(variant: PvVariant, numeroMission: string, version = 1): string {
  const prefix = variant === "livraison" ? "PV-LIV" : "PV-RES";
  const base = `${prefix}-${(numeroMission || "").trim() || "—"}`;
  return version > 1 ? `${base}-v${version}` : base;
}


export async function generatePvMissionPdf(
  variant: PvVariant,
  d: PvMissionData,
  company?: CompanyInfo | null,
  context?: PdfRenderContext,
): Promise<Blob> {
  const asset = variant === "livraison" ? livraisonTemplate : restitutionTemplate;
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error("Le modèle de PV n'est pas disponible.");
  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const page = pdf.getPages()[0];
  if (!page) throw new Error("Modèle de PV vide.");
  const { width, height } = page.getSize();
  const c = company ?? (context?.demo ? null : await fetchCompanyInfo());
  const doc = new jsPDF({ unit: "pt", format: [width, height] });
  applyLigneoFonts(doc);
  // Coordinates are those of the supplied vector PDFs, not a reconstructed layout.
  function text(value: unknown, x: number, baseline: number, maxWidth: number, size = 7.5, accent = false, align: "left" | "right" = "left") {
    const content = String(value ?? "").trim();
    if (!content) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const measured = doc.getTextWidth(content);
    if (measured > maxWidth) doc.setFontSize(Math.max(5.5, size * maxWidth / measured));
    doc.setTextColor(...(accent ? DOC_GOLD : DOC_TEXT));
    const lines = doc.splitTextToSize(content, maxWidth) as string[];
    doc.text(lines[0] ?? "", x, baseline, { align });
  }
  const town = c?.adresse_ville || "Tours";
  const department = c?.adresse_cp?.slice(0, 2) || "37";
  text(`Convoyage automobile B2B · ${town.toUpperCase()} (${department})`, 83.7, 72, 240, 8.2);
  text(d.numero_pv, 564, 72, 220, 9.5, true, "right");
  text(d.date_livraison ? `Date / heure : ${d.date_livraison}` : `Date : ____ / ____ / ${new Date().getFullYear()}    Heure : ____ h ____`, 564, 88, 220, 8, false, "right");
  text([c?.raison_sociale || "Transports Ligneo", toSiren(c?.siret) ? `SIREN ${toSiren(c?.siret)}` : null].filter(Boolean).join(" · "), 40.2, 143, 155, 7.3);
  text(d.donneur_ordre, 219.8, 143, 157);
  text(d.destinataire, 399.4, 143, 150);
  text(d.marque_modele, 40.2, 200, 160);
  doc.setFont("helvetica", "bold");
  const plate = (d.immatriculation ?? "").toUpperCase().replace(/\s/g, "");
  text(plate, 247.3, 213, 92, 13);
  text(formatVin(normalizeVin(d.vin)), 394.5, 200, 159, 7.5);
  text(d.numero_mission, 40.2, 247, 159);
  text(d.kilometrage_arrivee, 217.3, 247, 159);
  text(d.carburant, 394.5, 247, 159);
  text(d.lieu_prise_en_charge, 40.2, 306, 247);
  text(d.lieu_livraison, 305.9, 306, 245);
  text(d.date_prise_en_charge, 40.2, 334.5, 247);
  text(d.date_livraison, 305.9, 334.5, 245);
  const damages = (d.dommages ?? []).map((dm) => [`(${dm.code})`, dm.zone, dm.note].filter(Boolean).join(" ")).join(" · ");
  if (damages) {
    doc.setFontSize(6.8);
    doc.setTextColor(...DOC_TEXT);
    const lines = doc.splitTextToSize(damages, 410) as string[];
    doc.text(lines.slice(0, 2), 31.2, 540, { lineHeightFactor: 1.2 });
    // The supplied default check must not claim conformity when anomalies exist.
    doc.setFillColor(...DOC_GOLD);
    doc.roundedRect(43.3, 360.3, 10.3, 10.3, 2, 2, "F");
    text("×", 315, 369, 10, 11, true);
  }
  for (const [signature, x] of [[d.signatures?.convoyeur, 31.2], [d.signatures?.contrepartie, 305.1]] as const) {
    if (!signature) continue;
    try {
      const image = doc.getImageProperties(signature);
      const scale = Math.min(160 / image.width, 17 / image.height);
      doc.addImage(signature, image.fileType, x, 767, image.width * scale, image.height * scale);
    } catch { /* Optional signatures must not block an otherwise usable PV. */ }
  }
  doc.setTextColor(...DOC_MUTED);
  text(`${c?.raison_sociale || "Transports Ligneo"} · ${town.toUpperCase()} (${department})`, 31.2, 826, 225, 6.4);
  text(c?.email_contact || "contact@transportsligneo.fr", 469, 826, 180, 6.4, false, "right");
  text((c?.site_web || "www.transportsligneo.fr").replace(/^https?:\/\//, ""), 564, 826, 91, 6.4, true, "right");
  markDemoPdf(doc, context);
  const overlay = await PDFDocument.load(doc.output("arraybuffer"));
  const [embedded] = await pdf.embedPages(overlay.getPages());
  if (embedded) page.drawPage(embedded, { x: 0, y: 0, width, height });
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
