import jsPDF from "jspdf";
// Logo officiel carré 1:1 — évite l'écrasement subi par logo-ligneo.png (ratio 2.65)
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import signatureGo from "@/assets/signature-go.png";


export interface FactureData {
  numero: string;
  type_facture: "particulier" | "b2b";
  statut?: string;
  date_facture?: string;
  date_mission?: string | null;
  date_echeance?: string | null;
  date_paiement?: string | null;
  mode_paiement?: string | null;
  conditions_paiement?: string | null;
  client_nom?: string | null;
  client_prenom?: string | null;
  client_societe?: string | null;
  client_fonction?: string | null;
  client_email?: string | null;
  client_telephone?: string | null;
  client_adresse?: string | null;
  client_siret?: string | null;
  client_tva?: string | null;
  designation?: string | null;
  depart?: string | null;
  arrivee?: string | null;
  distance_km?: number | null;
  prix_ht: number;
  tva_taux?: number;
  prix_tva?: number;
  prix_ttc: number;
  iban?: string | null;
  bic?: string | null;
  banque?: string | null;
}

const NAVY: [number, number, number] = [11, 16, 38];
const GOLD: [number, number, number] = [212, 175, 55];
const GOLD_SOFT: [number, number, number] = [245, 220, 150];
const TEXT: [number, number, number] = [40, 40, 50];
const MUTED: [number, number, number] = [110, 110, 120];
const LINE: [number, number, number] = [225, 220, 200];
const WHITE: [number, number, number] = [255, 255, 255];
const GREEN: [number, number, number] = [60, 160, 90];

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR"); } catch { return d; }
};

function drawHeader(doc: jsPDF, pageW: number, logoData: string | null, title: string, subtitle: string | null, numero: string, badge: { kind: "echeance" | "acquittee"; text: string; sub?: string } | null) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 58, "F");
  if (logoData) {
    try { doc.addImage(logoData, "PNG", 12, 8, 42, 42); } catch {}
  }
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let y = 16;
  doc.setTextColor(...GOLD); doc.text("•", 60, y); doc.setTextColor(...WHITE); doc.text("Convoyage automobile premium", 65, y);
  y += 7; doc.setTextColor(...GOLD); doc.text("@", 60, y); doc.setTextColor(...WHITE); doc.text("contact@transportsligneo.fr", 65, y);
  y += 7; doc.setTextColor(...GOLD); doc.text("T", 60, y); doc.setTextColor(...WHITE); doc.text("07 82 45 61 81", 65, y);
  y += 7; doc.setTextColor(...GOLD); doc.text("W", 60, y); doc.setTextColor(...WHITE); doc.text("www.transportsligneo.fr", 65, y);

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title, pageW - 14, 18, { align: "right" });
  if (subtitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    doc.text(subtitle, pageW - 14, 25, { align: "right" });
  }

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.roundedRect(pageW - 82, 30, 68, 11, 1.5, 1.5, "S");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(numero, pageW - 48, 37, { align: "center" });

  if (badge) {
    doc.setDrawColor(...GOLD);
    doc.roundedRect(pageW - 82, 43, 68, 11, 1.5, 1.5, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(badge.kind === "acquittee" ? GREEN[0] : GOLD[0], badge.kind === "acquittee" ? GREEN[1] : GOLD[1], badge.kind === "acquittee" ? GREEN[2] : GOLD[2]);
    doc.text(badge.text, pageW - 48, 48, { align: "center" });
    if (badge.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...WHITE);
      doc.text(badge.sub, pageW - 48, 52.5, { align: "center" });
    }
  }

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(0, 58, pageW, 58);
}

function drawFooter(doc: jsPDF, pageW: number, pageH: number) {
  doc.setFillColor(...NAVY);
  doc.rect(0, pageH - 26, pageW, 26, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(0, pageH - 26, pageW, pageH - 26);
  const items = [
    ["PROFESSIONNALISME", "Chauffeurs experimentes et formes"],
    ["PONCTUALITE", "Respect des delais garanti"],
    ["CONFIDENTIALITE", "Discretion et securite assurees"],
    ["ASSURANCE INCLUSE", "Tous risques inclus a chaque mission"],
  ];
  const colW = (pageW - 20) / items.length;
  items.forEach(([t, s], i) => {
    const x = 10 + i * colW + colW / 2;
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(t, x, pageH - 16, { align: "center" });
    doc.setTextColor(...GOLD_SOFT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(s, x, pageH - 10, { align: "center" });
  });
}

function drawSocietyBlock(doc: jsPDF, pageW: number, y: number) {
  // Bandeau émetteur simplifié — informations légales retirées en attendant validation officielle.
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, pageW - 28, 10, 1, 1, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Transports Ligneo", 20, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Convoyage automobile premium", pageW / 2, y + 6.5, { align: "center" });
  doc.setTextColor(...TEXT);
  doc.text("contact@transportsligneo.fr", pageW - 20, y + 6.5, { align: "right" });
}

function drawInfoRow(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, valueColor?: [number, number, number]) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.line(x, y + 8, x + w, y + 8);
  doc.setFillColor(...NAVY);
  doc.circle(x + 4, y + 4.5, 3, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(label, x + 10, y + 5.5);
  doc.setTextColor(...(valueColor || NAVY));
  doc.text(value, x + w - 2, y + 5.5, { align: "right" });
}

export async function generateFacturePdf(f: FactureData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logoData = await loadImageAsDataUrl(logoLigneo);
  const isB2B = f.type_facture === "b2b";
  const isPaid = f.statut === "payee" || !!f.date_paiement;
  const tvaTaux = f.tva_taux ?? 20;
  const ht = Number(f.prix_ht);
  const tva = Number(f.prix_tva ?? +(ht * tvaTaux / 100).toFixed(2));
  const ttc = Number(f.prix_ttc);

  const badge = isB2B
    ? { kind: "echeance" as const, text: "Echeance de paiement", sub: f.date_echeance ? fmtDate(f.date_echeance) : "30 jours" }
    : isPaid
    ? { kind: "acquittee" as const, text: "FACTURE ACQUITTEE", sub: f.date_paiement ? `Paiement recu le ${fmtDate(f.date_paiement)}` : "" }
    : { kind: "echeance" as const, text: "A regler", sub: f.date_echeance ? fmtDate(f.date_echeance) : "" };

  drawHeader(doc, pageW, logoData, isB2B ? "FACTURE B2B" : "FACTURE", isB2B ? "FLOTTES & PARTENAIRES" : null, f.numero, badge);

  // ===== FACTURE A =====
  let y = 68;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FACTURE A", 14, y);

  y += 8;
  doc.setFontSize(12);
  if (isB2B && f.client_societe) {
    doc.text(f.client_societe, 14, y); y += 6;
    if (f.client_fonction) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(f.client_fonction, 14, y); y += 5;
    }
  } else {
    doc.text(`${f.client_prenom || ""} ${f.client_nom || ""}`.trim(), 14, y); y += 6;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  if (f.client_adresse) {
    const lines = doc.splitTextToSize(f.client_adresse, 90);
    doc.text(lines, 14, y);
    y += lines.length * 4.5;
  }
  if (isB2B) {
    if (f.client_siret) { doc.text(`SIRET : ${f.client_siret}`, 14, y); y += 5; }
    if (f.client_tva) { doc.text(`TVA Intracom. : ${f.client_tva}`, 14, y); y += 5; }
    if (f.client_nom || f.client_prenom) {
      y += 3;
      doc.text(`Contact : ${f.client_prenom || ""} ${f.client_nom || ""}`.trim(), 14, y); y += 5;
    }
  }
  if (f.client_email) { doc.text(f.client_email, 14, y); y += 5; }
  if (f.client_telephone) { doc.text(f.client_telephone, 14, y); }

  // ===== Right info rows =====
  const rx = 110, rw = pageW - 110 - 14;
  let ry = 68;
  drawInfoRow(doc, rx, ry, rw, "Date de facture", fmtDate(f.date_facture || new Date().toISOString()));
  ry += 11; drawInfoRow(doc, rx, ry, rw, "Date de mission", fmtDate(f.date_mission));
  ry += 11; drawInfoRow(doc, rx, ry, rw, "Reference facture", f.numero);
  ry += 11; drawInfoRow(doc, rx, ry, rw, "Mode de paiement", f.mode_paiement || (isB2B ? "Virement bancaire" : "Carte bancaire"));
  if (isB2B) {
    ry += 11; drawInfoRow(doc, rx, ry, rw, "Conditions de paiement", f.conditions_paiement || "A 30 jours fin de mois");
    ry += 11; drawInfoRow(doc, rx, ry, rw, "Date d'echeance", fmtDate(f.date_echeance));
  } else {
    ry += 11; drawInfoRow(doc, rx, ry, rw, "Statut", isPaid ? "Payee" : "A regler", isPaid ? GREEN : undefined);
    if (isPaid && f.date_paiement) { ry += 11; drawInfoRow(doc, rx, ry, rw, "Date de paiement", fmtDate(f.date_paiement)); }
  }

  // ===== Designation table =====
  y = Math.max(y, ry + 14) + 4;
  if (y < 145) y = 145;
  doc.setFillColor(...NAVY);
  doc.rect(14, y, pageW - 28, 8, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DESIGNATION", 18, y + 5.5);
  doc.text("DISTANCE", pageW - 95, y + 5.5);
  doc.text("PRIX UNIT. HT", pageW - 60, y + 5.5);
  doc.text("TOTAL HT", pageW - 18, y + 5.5, { align: "right" });

  y += 12;
  const distance = f.distance_km ?? 0;
  const unit = distance > 0 ? +(ht / distance).toFixed(2) : ht;

  doc.setFillColor(...NAVY);
  doc.circle(20, y + 2, 3.5, "F");
  doc.setTextColor(...GOLD);
  doc.setFontSize(7);
  doc.text("C", 20, y + 3, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(f.designation || "Convoyage vehicule", 28, y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  if (f.depart && f.arrivee) {
    doc.text(`${f.depart} -> ${f.arrivee}${distance ? ` (${distance} km)` : ""}`, 28, y + 6);
  }
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Inclus : peages, carburant et assurance tous risques", 28, y + 11);

  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(`${distance} km`, pageW - 95, y + 4);
  doc.text(`${unit.toFixed(2)} EUR / km`, pageW - 60, y + 4);
  doc.setFont("helvetica", "bold");
  doc.text(eur(ht), pageW - 18, y + 4, { align: "right" });

  y += 18;
  doc.setDrawColor(...LINE);
  doc.line(14, y, pageW - 14, y);

  // ===== DETAILS + TOTAUX =====
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("DETAILS DE LA PRESTATION", 14, y);

  const depCity = (f.depart || "").split(",")[0];
  const arrCity = (f.arrivee || "").split(",")[0];
  const details = [
    `Prise en charge du vehicule a ${depCity}`,
    `Livraison du vehicule a ${arrCity}`,
    "Peages inclus",
    "Carburant inclus",
    "Assurance tous risques incluse",
    "Convoyage realise par chauffeur professionnel",
  ];
  let dy = y + 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  details.forEach((t) => {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.circle(17, dy - 1.2, 1.6, "S");
    doc.setTextColor(...GOLD);
    doc.setFontSize(7);
    doc.text("v", 17, dy - 0.4, { align: "center" });
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(t, 22, dy);
    dy += 6.5;
  });

  // Totaux right
  const tx = pageW - 90;
  let ty = y + 4;
  doc.setFillColor(...NAVY);
  doc.rect(tx, ty, 50, 10, "F");
  doc.setTextColor(...GOLD_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TOTAL HT", tx + 25, ty + 6.5, { align: "center" });
  doc.setDrawColor(...LINE);
  doc.rect(tx + 50, ty, 26, 10, "S");
  doc.setTextColor(...NAVY);
  doc.text(eur(ht), tx + 50 + 23, ty + 6.5, { align: "right" });

  ty += 10;
  doc.setFillColor(...NAVY);
  doc.rect(tx, ty, 50, 10, "F");
  doc.setTextColor(...GOLD_SOFT);
  doc.text(`TVA (${tvaTaux}%)`, tx + 25, ty + 6.5, { align: "center" });
  doc.setDrawColor(...LINE);
  doc.rect(tx + 50, ty, 26, 10, "S");
  doc.setTextColor(...NAVY);
  doc.text(eur(tva), tx + 50 + 23, ty + 6.5, { align: "right" });

  ty += 10;
  doc.setFillColor(...NAVY);
  doc.rect(tx, ty, 50, 12, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.text("TOTAL TTC", tx + 25, ty + 7.5, { align: "center" });
  doc.setFillColor(...GOLD);
  doc.rect(tx + 50, ty, 26, 12, "F");
  doc.setTextColor(...NAVY);
  doc.setFontSize(11);
  doc.text(eur(ttc), tx + 50 + 23, ty + 7.5, { align: "right" });

  // ===== CONDITIONS / IBAN =====
  y = Math.max(dy, ty + 12) + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(isB2B ? "CONDITIONS DE PAIEMENT B2B" : "REGLEMENT ET CONFIRMATION DE PAIEMENT", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  if (isB2B) {
    doc.text("Reglement par virement bancaire a 30 jours fin de mois", 14, y); y += 4.5;
    doc.text("a compter de la date de facture.", 14, y); y += 4.5;
    doc.text("Aucun escompte pour paiement anticipe.", 14, y); y += 4.5;
    doc.text("En cas de retard de paiement, des penalites seront", 14, y); y += 4.5;
    doc.text("appliquees conformement a l'article L441-10 du Code de commerce.", 14, y); y += 4.5;
  } else if (isPaid) {
    const mode = (f.mode_paiement || "Carte bancaire").toLowerCase();
    doc.text(`Cette facture a ete reglee par ${mode}.`, 14, y); y += 4.5;
    if (f.date_paiement) { doc.text(`Le paiement a ete recu le ${fmtDate(f.date_paiement)}.`, 14, y); y += 4.5; }
    doc.text("Facture acquittee.", 14, y); y += 4.5;
    doc.text("Merci pour votre confiance.", 14, y); y += 4.5;
  } else {
    doc.text("Paiement a reception de facture.", 14, y); y += 4.5;
  }

  // Signature (remontée + alignée, plus collée au cadre)
  const sigBaseY = y - 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Pour Transports Ligneo", pageW - 18, sigBaseY, { align: "right" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Signature", pageW - 18, sigBaseY + 5, { align: "right" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text("G.O", pageW - 18, sigBaseY + 14, { align: "right" });

  // Coordonnees bancaires B2B
  if (isB2B) {
    y += 4;
    doc.setFillColor(...NAVY);
    doc.rect(14, y, 48, 12, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("COORDONNEES", 38, y + 5, { align: "center" });
    doc.text("BANCAIRES", 38, y + 9, { align: "center" });

    doc.setDrawColor(...LINE);
    doc.rect(62, y, pageW - 28 - 48, 12, "S");
    doc.setTextColor(...TEXT);
    doc.setFontSize(7);
    doc.text("Titulaire :", 66, y + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Transports Ligneo", 66, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Banque :", 100, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(f.banque || "Credit Mutuel", 100, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.text("IBAN :", 130, y + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(f.iban || "FR76 1562 9020 0100 0200 1234 567", 130, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.text("BIC :", pageW - 30, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(f.bic || "CMCIFR2A", pageW - 30, y + 8.5);
  }

  drawSocietyBlock(doc, pageW, pageH - 40);
  drawFooter(doc, pageW, pageH);

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
