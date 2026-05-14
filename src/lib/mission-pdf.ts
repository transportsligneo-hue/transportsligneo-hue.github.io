import jsPDF from "jspdf";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

export interface MissionPdfData {
  numero: string;
  date_mission?: string | null;
  heure_mission?: string | null;
  client_nom?: string | null;
  client_prenom?: string | null;
  client_societe?: string | null;
  client_email?: string | null;
  client_telephone?: string | null;
  convoyeur_nom?: string | null;
  convoyeur_prenom?: string | null;
  convoyeur_telephone?: string | null;
  depart: string;
  arrivee: string;
  depart_contact?: string | null;
  depart_telephone?: string | null;
  depart_horaires?: string | null;
  arrivee_contact?: string | null;
  arrivee_telephone?: string | null;
  arrivee_horaires?: string | null;
  distance_km?: number | null;
  duree_estimee?: string | null;
  marque?: string | null;
  modele?: string | null;
  immatriculation?: string | null;
  carburant?: string | null;
  mode_transport?: string | null;
  mode_paiement?: string | null;
  conditions_paiement?: string | null;
  instructions?: string | null;
  prix?: number | null;
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

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR"); } catch { return d; }
};

function drawFooter(doc: jsPDF, pageW: number, pageH: number) {
  doc.setFillColor(...NAVY);
  doc.rect(0, pageH - 22, pageW, 22, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(0, pageH - 22, pageW, pageH - 22);
  const items = [
    ["PROFESSIONNALISME", "Chauffeurs experimentes et formes"],
    ["PONCTUALITE", "Respect des delais garanti"],
    ["CONFIDENTIALITE", "Discretion et securite assurees"],
    ["ASSURANCE TOUS RISQUES", "Tous risques inclus a chaque mission"],
  ];
  const colW = (pageW - 20) / items.length;
  items.forEach(([t, s], i) => {
    const x = 10 + i * colW + colW / 2;
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(t, x, pageH - 14, { align: "center" });
    doc.setTextColor(...GOLD_SOFT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(s, x, pageH - 8, { align: "center" });
  });
}

function checkGold(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.circle(x, y - 1.2, 1.6, "S");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("v", x, y - 0.4, { align: "center" });
}

export async function generateMissionPdf(m: MissionPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logoData = await loadImageAsDataUrl(logoLigneo);

  // ===== HEADER =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 50, "F");
  if (logoData) { try { doc.addImage(logoData, "PNG", 12, 6, 36, 36); } catch {} }
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let y = 14;
  doc.setTextColor(...GOLD); doc.text("T", 54, y); doc.setTextColor(...WHITE); doc.text("07 82 45 61 81", 60, y);
  y += 7; doc.setTextColor(...GOLD); doc.text("@", 54, y); doc.setTextColor(...WHITE); doc.text("contact@transportsligneo.fr", 60, y);
  y += 7; doc.setTextColor(...GOLD); doc.text("W", 54, y); doc.setTextColor(...WHITE); doc.text("www.transportsligneo.fr", 60, y);

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("FICHE DE MISSION", pageW - 14, 18, { align: "right" });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.roundedRect(pageW - 78, 22, 64, 10, 1.5, 1.5, "S");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(m.numero, pageW - 46, 28.5, { align: "center" });

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Date de mission : ${fmtDate(m.date_mission)}`, pageW - 14, 39, { align: "right" });

  doc.setDrawColor(...GOLD);
  doc.line(0, 50, pageW, 50);

  // ===== TWO COLUMNS =====
  // Left: INFORMATIONS MISSION
  let yy = 58;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("INFORMATIONS MISSION", 14, yy);

  yy += 7;
  const infos: Array<[string, string]> = [
    ["Reference mission", m.numero],
    ["Date de mission", fmtDate(m.date_mission)],
    ["Convoyeur assigne", `${m.convoyeur_prenom || ""} ${m.convoyeur_nom || ""}`.trim() || "A attribuer"],
    ["Telephone convoyeur", m.convoyeur_telephone || "—"],
    ["Mode de transport", m.mode_transport || "Conduite sur route"],
    ["Kilometrage total estime", m.distance_km != null ? `${m.distance_km} km` : "—"],
    ["Duree estimee", m.duree_estimee || "—"],
    ["Carburant", m.carburant || "—"],
    ["Mode de paiement", m.mode_paiement || "—"],
    ["Conditions de paiement", m.conditions_paiement || "—"],
  ];
  doc.setFontSize(9);
  infos.forEach(([l, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(l, 14, yy);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.text(v, 100, yy, { align: "right" });
    yy += 5.5;
  });

  // Right: RAPPEL IMPORTANT
  const rx = 108;
  const rw = pageW - 14 - rx;
  let ry2 = 58;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(rx, ry2, rw, 78, 2, 2, "S");
  doc.setFillColor(...NAVY);
  doc.circle(rx + 7, ry2 + 7, 4, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("!", rx + 7, ry2 + 8.2, { align: "center" });
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.text("RAPPEL IMPORTANT", rx + 14, ry2 + 9);
  doc.setDrawColor(...GOLD);
  doc.line(rx + 4, ry2 + 13, rx + rw - 4, ry2 + 13);

  const rappels = [
    "Etat des lieux papier a completer avec le client (depart & arrivee)",
    "Verifier l'identite du signataire et les documents du vehicule",
    "Respecter les horaires de prise en charge et de livraison",
    "Informer immediatement en cas d'imprevu ou de retard",
    "Conduite respectueuse du code de la route et du vehicule",
    "Remettre l'ensemble des cles et documents au destinataire",
    "Faire signer le bon de livraison",
    "Retourner la fiche de mission completee a l'entreprise",
  ];
  let rry = ry2 + 19;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  rappels.forEach((t) => {
    checkGold(doc, rx + 7, rry);
    doc.setTextColor(...TEXT);
    const split = doc.splitTextToSize(t, rw - 18);
    doc.text(split, rx + 12, rry);
    rry += Math.max(6, split.length * 4);
  });

  // ===== LIEUX =====
  yy = Math.max(yy, ry2 + 84) + 4;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, yy, pageW - 28, 36, 2, 2, "S");

  // Pickup
  doc.setFillColor(...GOLD);
  doc.circle(20, yy + 8, 3, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("P", 20, yy + 9, { align: "center" });
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.text("LIEU DE PRISE EN CHARGE", 26, yy + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  const depLines = doc.splitTextToSize(m.depart, 70);
  doc.text(depLines, 18, yy + 16);
  let py = yy + 16 + depLines.length * 4.5;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  if (m.depart_contact) { doc.text(`Contact : ${m.depart_contact}`, 18, py); py += 4; }
  if (m.depart_telephone) { doc.text(m.depart_telephone, 18, py); py += 4; }
  if (m.depart_horaires) { doc.text(`Horaires : ${m.depart_horaires}`, 18, py); }

  // Center box
  const cx = pageW / 2 - 18;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(cx, yy + 6, 36, 24, 1.5, 1.5, "S");
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("DISTANCE", cx + 18, yy + 11, { align: "center" });
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.text(m.distance_km != null ? `${m.distance_km} km` : "—", cx + 18, yy + 16, { align: "center" });
  doc.setDrawColor(...LINE);
  doc.line(cx + 4, yy + 19, cx + 32, yy + 19);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text("DUREE ESTIMEE", cx + 18, yy + 23, { align: "center" });
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.text(m.duree_estimee || "—", cx + 18, yy + 28, { align: "center" });

  // Delivery
  const dx = pageW / 2 + 24;
  doc.setFillColor(...GOLD);
  doc.circle(dx + 4, yy + 8, 3, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("L", dx + 4, yy + 9, { align: "center" });
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.text("LIEU DE LIVRAISON", dx + 10, yy + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  const arrLines = doc.splitTextToSize(m.arrivee, 70);
  doc.text(arrLines, dx + 2, yy + 16);
  let ay2 = yy + 16 + arrLines.length * 4.5;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  if (m.arrivee_contact) { doc.text(`Contact : ${m.arrivee_contact}`, dx + 2, ay2); ay2 += 4; }
  if (m.arrivee_telephone) { doc.text(m.arrivee_telephone, dx + 2, ay2); ay2 += 4; }
  if (m.arrivee_horaires) { doc.text(`Horaires : ${m.arrivee_horaires}`, dx + 2, ay2); }

  // ===== INSTRUCTIONS + DOCUMENTS =====
  yy += 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("INSTRUCTIONS DE MISSION", 14, yy);
  doc.text("DOCUMENTS A AVOIR", pageW / 2 + 6, yy);

  const instr = m.instructions
    ? m.instructions.split("\n").map((s) => s.trim()).filter(Boolean)
    : [
        "Prise en charge du vehicule a l'adresse indiquee",
        "Conduite securisee et respectueuse du vehicule",
        "Livraison du vehicule a l'adresse indiquee",
        "Remise des cles et documents au destinataire",
        "Signature du bon de livraison par le destinataire",
        "Informer l'entreprise en cas de probleme ou retard",
        "Retourner la fiche de mission completee",
      ];
  let iy = yy + 6;
  doc.setFontSize(8);
  instr.slice(0, 7).forEach((t) => {
    checkGold(doc, 17, iy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT);
    const split = doc.splitTextToSize(t, pageW / 2 - 30);
    doc.text(split, 22, iy);
    iy += Math.max(5, split.length * 4);
  });

  const docs = ["Carte grise", "Attestation d'assurance", "Permis de conduire", "Fiche de mission", "Etat des lieux (papier)"];
  let dy2 = yy + 6;
  docs.forEach((t) => {
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("D", pageW / 2 + 6, dy2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT);
    doc.text(t, pageW / 2 + 12, dy2);
    dy2 += 5;
  });

  dy2 += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("A NE PAS OUBLIER", pageW / 2 + 6, dy2);
  dy2 += 5;
  const dont = [
    "Respecter les horaires de prise en charge et de livraison",
    "Informer en cas d'imprevu ou de retard",
    "Ne pas fumer dans le vehicule",
    "Rester joignable pendant toute la mission",
  ];
  doc.setFontSize(8);
  dont.forEach((t) => {
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("!", pageW / 2 + 6, dy2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT);
    const split = doc.splitTextToSize(t, pageW / 2 - 22);
    doc.text(split, pageW / 2 + 11, dy2);
    dy2 += Math.max(4, split.length * 4);
  });

  // ===== SIGNATURES =====
  yy = Math.max(iy, dy2) + 6;
  if (yy > pageH - 50) yy = pageH - 50;

  // Pickup signature
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, yy, 62, 24, 1, 1, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("PRISE EN CHARGE DU VEHICULE", 17, yy + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("Date : ___ / ___ / _____   Heure : ______", 17, yy + 11);
  doc.text("Nom du signataire : _____________________", 17, yy + 16);
  doc.text("Signature :", 17, yy + 21);

  // Emergency
  const ex = pageW / 2 - 22;
  doc.setDrawColor(...GOLD);
  doc.roundedRect(ex, yy, 44, 24, 1, 1, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("EN CAS D'URGENCE", ex + 22, yy + 5, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text("07 82 45 61 81", ex + 22, yy + 12, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.text("TRANSPORTS LIGNEO", ex + 22, yy + 17, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Disponible 24h/24 - 7j/7", ex + 22, yy + 21, { align: "center" });

  // Delivery signature
  doc.setDrawColor(...LINE);
  doc.roundedRect(pageW - 76, yy, 62, 24, 1, 1, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("LIVRAISON DU VEHICULE", pageW - 73, yy + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("Date : ___ / ___ / _____   Heure : ______", pageW - 73, yy + 11);
  doc.text("Nom du signataire : _____________________", pageW - 73, yy + 16);
  doc.text("Signature :", pageW - 73, yy + 21);

  drawFooter(doc, pageW, pageH);
  return doc.output("blob");
}

export function downloadMissionPdf(blob: Blob, numero: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Mission-${numero}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
