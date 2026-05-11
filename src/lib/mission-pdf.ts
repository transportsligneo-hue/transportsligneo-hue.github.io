import jsPDF from "jspdf";
import logoLigneo from "@/assets/logo-ligneo.png";

export interface MissionPdfData {
  numero: string;
  date_mission?: string | null;
  heure_mission?: string | null;
  // Client
  client_nom?: string | null;
  client_prenom?: string | null;
  client_societe?: string | null;
  client_email?: string | null;
  client_telephone?: string | null;
  // Convoyeur
  convoyeur_nom?: string | null;
  convoyeur_prenom?: string | null;
  convoyeur_telephone?: string | null;
  // Trajet
  depart: string;
  arrivee: string;
  distance_km?: number | null;
  duree_estimee?: string | null;
  // Véhicule
  marque?: string | null;
  modele?: string | null;
  immatriculation?: string | null;
  carburant?: string | null;
  // Instructions
  instructions?: string | null;
  prix?: number | null;
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
  } catch { return null; }
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return d; }
}

export async function generateMissionPdf(m: MissionPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // HEADER
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 42, "F");
  const logoData = await loadImageAsDataUrl(logoLigneo);
  if (logoData) { try { doc.addImage(logoData, "PNG", 15, 8, 26, 26); } catch {} }
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

  // TITLE
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("FICHE DE MISSION", 15, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`N° ${m.numero}`, 15, 65);
  doc.text(`Date : ${fmtDate(m.date_mission)}${m.heure_mission ? ` à ${m.heure_mission}` : ""}`, 15, 70);

  // CLIENT + CONVOYEUR cards
  let y = 82;
  const colW = (pageW - 30 - 6) / 2;

  // Client
  doc.setFillColor(...SOFT);
  doc.rect(15, y, colW, 36, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.rect(15, y, colW, 36, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("CLIENT", 20, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  let cy = y + 14;
  if (m.client_societe) { doc.setFont("helvetica", "bold"); doc.text(m.client_societe, 20, cy); doc.setFont("helvetica", "normal"); cy += 5; }
  const nom = `${m.client_prenom || ""} ${m.client_nom || ""}`.trim();
  if (nom) { doc.text(nom, 20, cy); cy += 5; }
  doc.setFontSize(8); doc.setTextColor(...MUTED);
  if (m.client_email) { doc.text(m.client_email, 20, cy); cy += 4; }
  if (m.client_telephone) { doc.text(m.client_telephone, 20, cy); }

  // Convoyeur
  const cx = 15 + colW + 6;
  doc.setFillColor(...SOFT);
  doc.rect(cx, y, colW, 36, "F");
  doc.setDrawColor(...GOLD);
  doc.rect(cx, y, colW, 36, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("CONVOYEUR", cx + 5, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  let vy = y + 14;
  const cn = `${m.convoyeur_prenom || ""} ${m.convoyeur_nom || ""}`.trim() || "À attribuer";
  doc.text(cn, cx + 5, vy); vy += 5;
  doc.setFontSize(8); doc.setTextColor(...MUTED);
  if (m.convoyeur_telephone) doc.text(m.convoyeur_telephone, cx + 5, vy);

  // TRAJET
  y = 128;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("TRAJET", 15, y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(15, y + 2, 50, y + 2);
  y += 10;

  const trows: Array<[string, string]> = [
    ["Départ", m.depart],
    ["Arrivée", m.arrivee],
  ];
  if (m.distance_km != null) trows.push(["Distance", `${m.distance_km} km`]);
  if (m.duree_estimee) trows.push(["Durée estimée", m.duree_estimee]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  trows.forEach(([l, v]) => {
    doc.setTextColor(...MUTED); doc.text(l, 20, y);
    doc.setTextColor(...TEXT); doc.text(v, 70, y);
    y += 6;
  });

  // VEHICULE
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("VÉHICULE", 15, y);
  doc.setDrawColor(...GOLD);
  doc.line(15, y + 2, 50, y + 2);
  y += 10;

  const vrows: Array<[string, string]> = [];
  if (m.marque || m.modele) vrows.push(["Modèle", `${m.marque || ""} ${m.modele || ""}`.trim()]);
  if (m.immatriculation) vrows.push(["Immatriculation", m.immatriculation]);
  if (m.carburant) vrows.push(["Carburant", m.carburant]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  vrows.forEach(([l, v]) => {
    doc.setTextColor(...MUTED); doc.text(l, 20, y);
    doc.setTextColor(...TEXT); doc.text(v, 70, y);
    y += 6;
  });

  // INSTRUCTIONS
  if (m.instructions) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("INSTRUCTIONS", 15, y);
    doc.setDrawColor(...GOLD);
    doc.line(15, y + 2, 65, y + 2);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    const split = doc.splitTextToSize(m.instructions, pageW - 30);
    doc.text(split, 15, y);
    y += split.length * 5;
  }

  // FOOTER
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
  doc.text("Document de mission — confidentiel, à conserver par le convoyeur.", pageW / 2, pageH - 9, { align: "center" });
  doc.text("contact@transportsligneo.fr  •  07 82 45 61 81  •  transportsligneo.fr", pageW / 2, pageH - 4, { align: "center" });

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
