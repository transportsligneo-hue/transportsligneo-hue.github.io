import jsPDF from "jspdf";
import logoLigneo from "@/assets/logo-ligneo.png";

export interface FactureData {
  numero: string;
  type_facture: "particulier" | "b2b";
  date_facture?: string;
  date_mission?: string | null;
  date_echeance?: string | null;
  mode_paiement?: string | null;
  conditions_paiement?: string | null;
  // Client
  client_nom?: string | null;
  client_prenom?: string | null;
  client_societe?: string | null;
  client_email?: string | null;
  client_adresse?: string | null;
  client_siret?: string | null;
  client_tva?: string | null;
  // Mission
  designation?: string | null;
  depart?: string | null;
  arrivee?: string | null;
  distance_km?: number | null;
  // Montants
  prix_ht: number;
  tva_taux?: number;
  prix_tva?: number;
  prix_ttc: number;
}

const NAVY: [number, number, number] = [11, 16, 38];
const GOLD: [number, number, number] = [212, 175, 55];
const GOLD_LIGHT: [number, number, number] = [231, 199, 106];
const TEXT: [number, number, number] = [50, 50, 50];
const MUTED: [number, number, number] = [120, 120, 120];
const SOFT: [number, number, number] = [248, 246, 240];

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export async function generateFacturePdf(facture: FactureData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const isB2B = facture.type_facture === "b2b";
  const tvaTaux = facture.tva_taux ?? 20;
  const tva = facture.prix_tva ?? +(facture.prix_ht * tvaTaux / 100).toFixed(2);

  // ===== HEADER =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 42, "F");

  const logoData = await loadImageAsDataUrl(logoLigneo);
  if (logoData) {
    try { doc.addImage(logoData, "PNG", 15, 8, 26, 26); } catch {}
  }

  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("TRANSPORTS LIGNEO", 48, 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD_LIGHT);
  doc.text("Convoyage automobile premium", 48, 25);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("contact@transportsligneo.fr  |  07 82 45 61 81  |  transportsligneo.fr", 48, 31);

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(15, 42, pageW - 15, 42);

  // ===== TITLE =====
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("FACTURE", 15, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`N° ${facture.numero}`, 15, 65);
  doc.text(`Date : ${fmtDate(facture.date_facture || new Date().toISOString())}`, 15, 70);

  // Right column
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  if (facture.date_echeance) {
    doc.text(`Échéance : ${fmtDate(facture.date_echeance)}`, pageW - 15, 65, { align: "right" });
  }
  if (facture.date_mission) {
    doc.text(`Mission du : ${fmtDate(facture.date_mission)}`, pageW - 15, 70, { align: "right" });
  }

  // ===== EMITTER + CLIENT =====
  let y = 82;
  const colW = (pageW - 30 - 6) / 2;

  // Emitter (left)
  doc.setFillColor(...SOFT);
  doc.rect(15, y, colW, 38, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.rect(15, y, colW, 38, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("ÉMETTEUR", 20, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text("Transports Ligneo", 20, y + 14);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Convoyage automobile premium", 20, y + 19);
  doc.text("contact@transportsligneo.fr", 20, y + 24);
  doc.text("07 82 45 61 81", 20, y + 29);
  doc.text("SIRET : 000 000 000 00000", 20, y + 34);

  // Client (right)
  const cx = 15 + colW + 6;
  doc.setFillColor(...SOFT);
  doc.rect(cx, y, colW, 38, "F");
  doc.setDrawColor(...GOLD);
  doc.rect(cx, y, colW, 38, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(isB2B ? "FACTURÉ À" : "CLIENT", cx + 5, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  let cy = y + 14;
  if (isB2B && facture.client_societe) {
    doc.setFont("helvetica", "bold");
    doc.text(facture.client_societe, cx + 5, cy);
    doc.setFont("helvetica", "normal");
    cy += 5;
  }
  const nomComplet = `${facture.client_prenom || ""} ${facture.client_nom || ""}`.trim();
  if (nomComplet) { doc.text(nomComplet, cx + 5, cy); cy += 5; }
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  if (facture.client_adresse) {
    const split = doc.splitTextToSize(facture.client_adresse, colW - 10);
    doc.text(split, cx + 5, cy); cy += split.length * 4;
  }
  if (facture.client_email) { doc.text(facture.client_email, cx + 5, cy); cy += 4; }
  if (isB2B && facture.client_siret) { doc.text(`SIRET : ${facture.client_siret}`, cx + 5, cy); cy += 4; }
  if (isB2B && facture.client_tva) { doc.text(`TVA : ${facture.client_tva}`, cx + 5, cy); }

  // ===== DESIGNATION TABLE =====
  y = 130;
  doc.setFillColor(...NAVY);
  doc.rect(15, y, pageW - 30, 9, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DÉSIGNATION", 20, y + 6);
  doc.text("QTÉ", pageW - 75, y + 6, { align: "right" });
  doc.text("PRIX HT", pageW - 50, y + 6, { align: "right" });
  doc.text("TOTAL HT", pageW - 20, y + 6, { align: "right" });

  y += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const designation = facture.designation || "Prestation de convoyage automobile";
  doc.text(designation, 20, y);
  if (facture.depart && facture.arrivee) {
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Trajet : ${facture.depart} → ${facture.arrivee}`, 20, y);
  }
  if (facture.distance_km != null) {
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Distance : ${facture.distance_km} km`, 20, y);
  }

  // Right side amounts (aligned with first description line)
  const amountY = y - (facture.distance_km != null ? 9 : facture.depart ? 5 : 0);
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text("1", pageW - 75, amountY, { align: "right" });
  doc.text(fmtMoney(facture.prix_ht), pageW - 50, amountY, { align: "right" });
  doc.text(fmtMoney(facture.prix_ht), pageW - 20, amountY, { align: "right" });

  y += 10;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(15, y, pageW - 15, y);

  // ===== TOTALS =====
  y += 10;
  const tx = pageW - 90;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text("Total HT", tx, y);
  doc.text(fmtMoney(facture.prix_ht), pageW - 20, y, { align: "right" });
  y += 6;
  doc.text(`TVA ${tvaTaux}%`, tx, y);
  doc.text(fmtMoney(tva), pageW - 20, y, { align: "right" });
  y += 4;
  doc.setDrawColor(...GOLD);
  doc.line(tx, y, pageW - 20, y);
  y += 8;

  // TTC band
  doc.setFillColor(...NAVY);
  doc.rect(tx - 5, y - 6, pageW - 20 - tx + 5, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD_LIGHT);
  doc.text("TOTAL TTC", tx, y + 2);
  doc.setFontSize(14);
  doc.setTextColor(...GOLD);
  doc.text(fmtMoney(facture.prix_ttc), pageW - 20, y + 2, { align: "right" });

  // ===== PAIEMENT =====
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("MODALITÉS DE PAIEMENT", 15, y);
  doc.setDrawColor(...GOLD);
  doc.line(15, y + 2, 80, y + 2);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  if (facture.mode_paiement) { doc.text(`Mode de paiement : ${facture.mode_paiement}`, 15, y); y += 5; }
  if (facture.conditions_paiement) {
    const split = doc.splitTextToSize(facture.conditions_paiement, pageW - 30);
    doc.text(split, 15, y);
    y += split.length * 5;
  } else if (isB2B) {
    doc.text("Paiement à 30 jours nets à compter de la date d'émission.", 15, y);
    y += 5;
  } else {
    doc.text("Paiement à réception de facture.", 15, y);
    y += 5;
  }
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text("Pénalités de retard : 3 fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €.", 15, y);

  // ===== FOOTER =====
  doc.setFillColor(...NAVY);
  doc.rect(0, pageH - 22, pageW, 22, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(0, pageH - 22, pageW, pageH - 22);
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TRANSPORTS LIGNEO", pageW / 2, pageH - 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(220, 220, 220);
  doc.text("TVA non applicable, art. 293 B du CGI — ou taux légal en vigueur selon le régime.", pageW / 2, pageH - 9, { align: "center" });
  doc.text("contact@transportsligneo.fr  •  07 82 45 61 81  •  transportsligneo.fr", pageW / 2, pageH - 4, { align: "center" });

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
