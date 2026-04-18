import jsPDF from "jspdf";
import logoLigneo from "@/assets/logo-ligneo.png";

export interface DevisData {
  numero: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string | null;
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
  created_at?: string;
}

// Brand colors (RGB)
const NAVY: [number, number, number] = [11, 16, 38];
const GOLD: [number, number, number] = [212, 175, 55];
const GOLD_LIGHT: [number, number, number] = [231, 199, 106];
const TEXT: [number, number, number] = [50, 50, 50];
const MUTED: [number, number, number] = [120, 120, 120];

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

export async function generateDevisPdf(devis: DevisData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ===== HEADER (navy band) =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 42, "F");

  const logoData = await loadImageAsDataUrl(logoLigneo);
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", 15, 8, 26, 26);
    } catch { /* ignore */ }
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

  // Gold separator
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(15, 42, pageW - 15, 42);

  // ===== TITLE & numero =====
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("DEVIS", 15, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`N° ${devis.numero}`, 15, 65);
  const dateStr = new Date(devis.created_at || new Date()).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  doc.text(`Date : ${dateStr}`, 15, 70);

  // Right side - validity
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text("Devis valable 30 jours", pageW - 15, 65, { align: "right" });

  // ===== CLIENT BLOCK =====
  let y = 82;
  doc.setFillColor(248, 246, 240);
  doc.rect(15, y, pageW - 30, 28, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.rect(15, y, pageW - 30, 28, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("CLIENT", 20, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`${devis.prenom} ${devis.nom}`, 20, y + 14);
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(devis.email, 20, y + 20);
  if (devis.telephone) doc.text(devis.telephone, 20, y + 25);

  // ===== TRAJET BLOCK =====
  y = 118;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("DÉTAILS DU TRAJET", 15, y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(15, y + 2, 75, y + 2);

  y += 10;
  const rows: Array<[string, string]> = [
    ["Départ", devis.depart],
    ["Arrivée", devis.arrivee],
  ];
  if (devis.distance_km != null) rows.push(["Distance estimée", `${devis.distance_km} km`]);
  if (devis.duree_estimee) rows.push(["Durée estimée", devis.duree_estimee]);
  if (devis.date_souhaitee) {
    const d = new Date(devis.date_souhaitee).toLocaleDateString("fr-FR");
    rows.push(["Date souhaitée", devis.heure_souhaitee ? `${d} à ${devis.heure_souhaitee}` : d]);
  }
  if (devis.option_trajet) rows.push(["Type de trajet", devis.option_trajet]);
  if (devis.prestation) rows.push(["Prestation", devis.prestation]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  rows.forEach(([label, value]) => {
    doc.setTextColor(...MUTED);
    doc.text(label, 20, y);
    doc.setTextColor(...TEXT);
    doc.text(value, 75, y);
    y += 6;
  });

  // ===== VEHICLE BLOCK =====
  if (devis.type_vehicule || devis.marque || devis.modele || devis.carburant) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("VÉHICULE", 15, y);
    doc.setDrawColor(...GOLD);
    doc.line(15, y + 2, 50, y + 2);
    y += 10;

    const vRows: Array<[string, string]> = [];
    if (devis.type_vehicule) vRows.push(["Type", devis.type_vehicule]);
    if (devis.marque || devis.modele) vRows.push(["Modèle", `${devis.marque || ""} ${devis.modele || ""}`.trim()]);
    if (devis.carburant) vRows.push(["Carburant", devis.carburant]);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    vRows.forEach(([label, value]) => {
      doc.setTextColor(...MUTED);
      doc.text(label, 20, y);
      doc.setTextColor(...TEXT);
      doc.text(value, 75, y);
      y += 6;
    });
  }

  // ===== PRICE BLOCK =====
  y += 6;
  if (y > pageH - 80) y = pageH - 80;

  doc.setFillColor(...NAVY);
  doc.rect(15, y, pageW - 30, 32, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.rect(15, y, pageW - 30, 32, "S");

  doc.setTextColor(...GOLD_LIGHT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("MONTANT ESTIMÉ", 22, y + 10);
  if (devis.tarif_label) {
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(devis.tarif_label, 22, y + 16);
  }
  if (devis.multiplier_label) {
    doc.setFontSize(8);
    doc.setTextColor(...GOLD_LIGHT);
    doc.text(devis.multiplier_label, 22, y + 22);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...GOLD);
  doc.text(`${devis.prix_estime} €`, pageW - 22, y + 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text("TTC – Péage et carburant inclus", pageW - 22, y + 26, { align: "right" });

  y += 40;

  // Message
  if (devis.message && y < pageH - 40) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text("Note du client", 15, y);
    y += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    const split = doc.splitTextToSize(devis.message, pageW - 30);
    doc.text(split, 15, y);
  }

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
  doc.text(
    "Estimation indicative — un devis définitif vous sera transmis après étude de votre demande.",
    pageW / 2, pageH - 9, { align: "center" }
  );
  doc.text("contact@transportsligneo.fr  •  07 82 45 61 81  •  transportsligneo.fr", pageW / 2, pageH - 4, { align: "center" });

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
