import jsPDF from "jspdf";

export interface VroomyDevisData {
  depart?: unknown;
  arrivee?: unknown;
  prix_ttc?: unknown;
  prix_ht?: unknown;
  distance_km?: unknown;
  delai_estime?: unknown;
  type_livraison?: unknown;
}

const NAVY: [number, number, number] = [11, 19, 56];
const GOLD: [number, number, number] = [201, 162, 39];
const GREY: [number, number, number] = [110, 118, 140];

function txt(v: unknown, fallback = "—") {
  return v === null || v === undefined || v === "" ? fallback : String(v);
}

function eur(v: unknown) {
  return typeof v === "number" ? `${Math.round(v)} €` : "—";
}

/** Génère et télécharge une estimation Vroomy au format PDF. */
export function downloadVroomyDevisPdf(data: VroomyDevisData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 46, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 46, W, 1.4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TRANSPORTS LIGNEO", 16, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(201, 162, 39);
  doc.text("Estimation de convoyage — générée par Vroomy", 16, 31);
  doc.setTextColor(200, 210, 235);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString("fr-FR"), W - 16, 31, { align: "right" });

  let y = 66;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Trajet estimé", 16, y);

  y += 10;
  const rows: Array<[string, string]> = [
    ["Départ", txt(data.depart)],
    ["Arrivée", txt(data.arrivee)],
    ["Distance", data.distance_km ? `${String(data.distance_km)} km` : "—"],
    ["Délai estimé", txt(data.delai_estime)],
    ["Type de livraison", txt(data.type_livraison)],
  ];

  doc.setFontSize(11);
  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GREY);
    doc.text(label, 16, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(value, 80, y);
    doc.setDrawColor(228, 232, 242);
    doc.line(16, y + 3, W - 16, y + 3);
    y += 11;
  });

  y += 8;
  doc.setFillColor(...NAVY);
  doc.roundedRect(16, y, W - 32, 28, 3, 3, "F");
  doc.setTextColor(201, 162, 39);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("MONTANT ESTIMÉ TTC", 24, y + 11);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(eur(data.prix_ttc), W - 24, y + 18, { align: "right" });

  y += 42;
  doc.setTextColor(...GREY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "Estimation indicative, non contractuelle, valable 30 jours et sous réserve de validation par nos équipes.",
    16,
    y,
    { maxWidth: W - 32 },
  );
  doc.text("Transports Ligneo — 07 82 45 61 81 — transportsligneo.fr", 16, 284);

  const slug = `${txt(data.depart, "depart")}-${txt(data.arrivee, "arrivee")}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`estimation-ligneo-${slug || "vroomy"}.pdf`);
}
