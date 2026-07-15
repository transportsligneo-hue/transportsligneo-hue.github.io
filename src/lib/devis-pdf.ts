import jsPDF from "jspdf";
// Logo officiel carré 1:1 — évite l'écrasement subi par logo-ligneo.png (ratio 2.65)
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import signatureGo from "@/assets/signature-go.png";


export interface DevisData {
  numero: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string | null;
  adresse?: string | null;
  /** Optional client company info shown in the "DEVIS ÉTABLI POUR" block. */
  societe?: string | null;
  siret?: string | null;
  tva_intra?: string | null;
  /** Optional public URL of the client company logo. */
  logo_url?: string | null;
  depart: string;
  arrivee: string;
  distance_km?: number | null;
  duree_estimee?: string | null;
  type_vehicule?: string | null;
  marque?: string | null;
  modele?: string | null;
  carburant?: string | null;
  prestation?: string | null;
  option_trajet?: string | null;
  date_souhaitee?: string | null;
  heure_souhaitee?: string | null;
  prix_estime: number;
  tarif_label?: string | null;
  multiplier_label?: string | null;
  message?: string | null;
  mode_paiement?: string | null;
  validite_jours?: number;
  created_at?: string;
  /** Version du devis (1 par défaut) — affichée si > 1 */
  version?: number | null;
  /** Signature manuscrite du client (data URL PNG) — bloc "Bon pour accord" */
  clientSignatureDataUrl?: string | null;
  /** Libellé de la date d'acceptation, ex "11/06/2026 à 14:32" */
  acceptedAtLabel?: string | null;
  /** Preuve de signature électronique par code OTP e-mail (cartouche dédié) */
  otpProof?: {
    email: string;
    method: string; // ex "Code de validation par e-mail (OTP 6 chiffres)"
    acceptedAtLabel: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    cgvVersion?: string | null;
    pdfHash?: string | null;
  } | null;
}

const NAVY: [number, number, number] = [11, 16, 38];
const GOLD: [number, number, number] = [212, 175, 55];
const GOLD_SOFT: [number, number, number] = [245, 220, 150];
const TEXT: [number, number, number] = [40, 40, 50];
const MUTED: [number, number, number] = [110, 110, 120];
const LINE: [number, number, number] = [225, 220, 200];
const WHITE: [number, number, number] = [255, 255, 255];

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

function drawHeader(doc: jsPDF, pageW: number, logoData: string | null, title: string, numero: string, validityLabel?: string) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 58, "F");
  if (logoData) {
    try { doc.addImage(logoData, "PNG", 12, 8, 42, 42); } catch {}
  }
  // Contact column
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let y = 16;
  doc.setTextColor(...GOLD);
  doc.text("•", 60, y); doc.setTextColor(...WHITE); doc.text("Convoyage automobile", 65, y);
  y += 7; doc.setTextColor(...GOLD); doc.text("@", 60, y); doc.setTextColor(...WHITE); doc.text("contact@transportsligneo.fr", 65, y);
  y += 7; doc.setTextColor(...GOLD); doc.text("T", 60, y); doc.setTextColor(...WHITE); doc.text("07 82 45 61 81", 65, y);
  y += 7; doc.setTextColor(...GOLD); doc.text("W", 60, y); doc.setTextColor(...WHITE); doc.text("www.transportsligneo.fr", 65, y);

  // Title + numero box (right)
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(title, pageW - 14, 20, { align: "right" });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.roundedRect(pageW - 78, 26, 64, 11, 1.5, 1.5, "S");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(numero, pageW - 46, 33, { align: "center" });

  if (validityLabel) {
    doc.setDrawColor(...GOLD);
    doc.roundedRect(pageW - 78, 40, 64, 10, 1.5, 1.5, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    doc.text(validityLabel, pageW - 46, 46.5, { align: "center" });
  }

  // gold separator
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
  doc.text("Convoyage automobile", pageW / 2, y + 6.5, { align: "center" });
  doc.setTextColor(...TEXT);
  doc.text("contact@transportsligneo.fr", pageW - 20, y + 6.5, { align: "right" });
}

function drawInfoRow(doc: jsPDF, x: number, y: number, w: number, label: string, value: string) {
  // gold thin border row
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.line(x, y + 8, x + w, y + 8);
  doc.setFillColor(...NAVY);
  doc.circle(x + 4, y + 4.5, 3, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("·", x + 4, y + 5.4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(label, x + 10, y + 5.5);
  doc.setTextColor(...NAVY);
  doc.text(value, x + w - 2, y + 5.5, { align: "right" });
}

export async function generateDevisPdf(d: DevisData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logoData = await loadImageAsDataUrl(logoLigneo);
  const signatureData = await loadImageAsDataUrl(signatureGo);
  const clientLogoData = d.logo_url ? await loadImageAsDataUrl(d.logo_url) : null;


  const validite = d.validite_jours ?? 15;
  const versionLabel = d.version && d.version > 1 ? ` · v${d.version}` : "";
  drawHeader(doc, pageW, logoData, "DEVIS", d.numero, `Validite : ${validite} jours${versionLabel}`);

  // ===== DEVIS ETABLI POUR =====
  let y = 68;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DEVIS ETABLI POUR", 14, y);

  // Client logo (top-right of client block, if provided)
  if (clientLogoData) {
    try { doc.addImage(clientLogoData, "PNG", 80, y - 4, 22, 22); } catch {}
  }

  y += 8;
  if (d.societe) {
    doc.setFontSize(13);
    doc.text(d.societe, 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(`${d.prenom} ${d.nom}`, 14, y);
  } else {
    doc.setFontSize(13);
    doc.text(`${d.prenom} ${d.nom}`, 14, y);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  y += 6;
  doc.text(d.email, 14, y);
  if (d.telephone) { y += 5; doc.text(d.telephone, 14, y); }
  if (d.siret) { y += 5; doc.text(`SIRET : ${d.siret}`, 14, y); }
  if (d.tva_intra) { y += 5; doc.text(`TVA intra. : ${d.tva_intra}`, 14, y); }
  if (d.adresse) {
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text("Adresse de facturation :", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT);
    const lines = doc.splitTextToSize(d.adresse, 80);
    doc.text(lines, 14, y);
  }

  // ===== Right info rows =====
  const rx = 110, rw = pageW - 110 - 14;
  let ry = 68;
  drawInfoRow(doc, rx, ry, rw, "Date du devis", fmtDate(d.created_at || new Date().toISOString()));
  ry += 11; drawInfoRow(doc, rx, ry, rw, "Date de mission souhaitee", fmtDate(d.date_souhaitee));
  ry += 11; drawInfoRow(doc, rx, ry, rw, "Reference devis", d.numero);
  ry += 11; drawInfoRow(doc, rx, ry, rw, "Validite du devis", `${validite} jours`);
  ry += 11; drawInfoRow(doc, rx, ry, rw, "Mode de paiement", d.mode_paiement || "Carte bancaire");

  // ===== PRESTATION PROPOSEE =====
  y = 134;
  doc.setFillColor(...NAVY);
  doc.rect(14, y, pageW - 28, 8, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PRESTATION PROPOSEE", 18, y + 5.5);

  y += 12;
  // Column headers
  doc.setDrawColor(...LINE);
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("DESIGNATION", 18, y);
  doc.text("DISTANCE", pageW - 95, y);
  doc.text("PRIX UNIT. HT", pageW - 60, y);
  doc.text("TOTAL HT", pageW - 18, y, { align: "right" });
  y += 2;
  doc.line(14, y, pageW - 14, y);

  // Body row
  y += 6;
  const distance = d.distance_km ?? 0;
  const ht = +(d.prix_estime / 1.2).toFixed(2);
  const tva = +(d.prix_estime - ht).toFixed(2);
  const unit = distance > 0 ? +(ht / distance).toFixed(2) : ht;

  doc.setFillColor(...NAVY);
  doc.circle(20, y + 2, 3.5, "F");
  doc.setTextColor(...GOLD);
  doc.setFontSize(7);
  doc.text("C", 20, y + 3, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("Convoyage vehicule", 28, y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(`${d.depart} -> ${d.arrivee}${distance ? ` (${distance} km)` : ""}`, 28, y + 6);
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

  // ===== DETAILS PRESTATION + TOTAUX =====
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("DETAILS DE LA PRESTATION", 14, y);

  const details = [
    `Prise en charge du vehicule a ${d.depart.split(",")[0]}`,
    `Livraison du vehicule a ${d.arrivee.split(",")[0]}`,
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

  // Totaux (right)
  const tx = pageW - 90;
  let ty = y + 4;
  // Total HT
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
  doc.text("TVA (20%)", tx + 25, ty + 6.5, { align: "center" });
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
  doc.text(eur(d.prix_estime), tx + 50 + 23, ty + 7.5, { align: "right" });

  // ===== CONDITIONS + SIGNATURE =====
  // Limite haute de la zone : on doit s'arrêter au-dessus du bandeau émetteur (pageH - 42)
  // pour empêcher tout chevauchement entre les conditions et le bloc société.
  y = Math.max(dy, ty + 12) + 8;
  const maxY = pageH - 50;
  if (y > maxY - 26) y = maxY - 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("CONDITIONS ET VALIDITE", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  doc.text(`Ce devis est valable ${validite} jours a compter de sa date d'emission.`, 14, y); y += 4.5;
  doc.text(`Le reglement s'effectue par ${(d.mode_paiement || "Carte bancaire").toLowerCase()}.`, 14, y); y += 4.5;
  doc.text("Aucun acompte n'est demande a la reservation.", 14, y); y += 4.5;
  doc.text("Devis soumis aux Conditions Generales de Vente (www.transportsligneo.fr/cgv).", 14, y); y += 4.5;
  doc.text("Merci pour votre confiance.", 14, y);

  // Signature société (droite)
  const sigBaseY = y - 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Pour Transports Ligneo", pageW - 18, sigBaseY, { align: "right" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Signature", pageW - 18, sigBaseY + 5, { align: "right" });
  if (signatureData) {
    try { doc.addImage(signatureData, "PNG", pageW - 52, sigBaseY + 4, 34, 18); } catch {}
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Olivier G.", pageW - 18, sigBaseY + 24, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Gerant", pageW - 18, sigBaseY + 28.5, { align: "right" });

  // Bloc "Bon pour accord" client (centre) — uniquement sur le PDF figé signé
  if (d.clientSignatureDataUrl) {
    const cx = pageW / 2 - 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text("Bon pour accord — Le client", cx, sigBaseY, { align: "left" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${d.prenom} ${d.nom}`, cx, sigBaseY + 5, { align: "left" });
    try { doc.addImage(d.clientSignatureDataUrl, "PNG", cx, sigBaseY + 7, 40, 16); } catch {}
    if (d.acceptedAtLabel) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`Signe electroniquement le ${d.acceptedAtLabel}`, cx, sigBaseY + 27, { align: "left" });
    }
  }



  // Société block + footer (placé juste au-dessus du footer pour éviter tout chevauchement)
  drawSocietyBlock(doc, pageW, pageH - 40);
  drawFooter(doc, pageW, pageH);

  return doc.output("blob");
}

export function downloadDevisPdf(blob: Blob, numero: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Devis-${numero}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
