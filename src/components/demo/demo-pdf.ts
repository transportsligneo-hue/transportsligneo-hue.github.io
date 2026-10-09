import type { ProMission } from "@/hooks/useProMissions";

/** PDF d'exemple pour la démo pro — données fictives uniquement. */
export async function downloadDemoPdf(kind: string, m: ProMission) {
  const [{ jsPDF }, { downloadBlob }] = await Promise.all([import("jspdf"), import("@/lib/documents-officiels")]);
  const doc = new jsPDF();
  doc.setFillColor(11, 16, 38);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("TRANSPORTS LIGNEO", 15, 18);
  doc.setFontSize(10);
  doc.text("DOCUMENT D'EXEMPLE — DÉMONSTRATION", 120, 18);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(18);
  doc.text(kind, 15, 48);
  doc.setFontSize(11);
  const ht = Math.round((m.prix_total ?? 0) / 1.2);
  const rows: [string, string][] = [
    ["Mission", m.numero],
    ["Date de prise en charge", `${m.date_prise_en_charge}${m.heure_prise_en_charge ? " à " + m.heure_prise_en_charge : ""}`],
    ["Départ", m.ville_depart ?? ""],
    ["Arrivée", m.ville_arrivee ?? ""],
    ["Véhicule", `${m.marque ?? ""} ${m.modele ?? ""}`],
    ["Immatriculation", m.immatriculation ?? ""],
    ["Montant HT", `${ht} €`],
    ["TVA 20 %", `${(m.prix_total ?? 0) - ht} €`],
    ["Montant TTC", `${m.prix_total ?? 0} €`],
  ];
  rows.forEach(([k, v], i) => {
    const y = 64 + i * 10;
    doc.setTextColor(110, 110, 110); doc.text(k, 15, y);
    doc.setTextColor(20, 20, 20); doc.text(String(v), 85, y);
  });
  if (kind.startsWith("PV")) {
    doc.text("Véhicule livré conforme. Réserve : rayure 4 cm porte arrière droite.", 15, 170);
    doc.text("Signature client : Claire Martin (exemple)", 15, 185);
  }
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text("Données fictives — aucune valeur contractuelle.", 15, 285);
  await downloadBlob(doc.output("blob"), `demo-${kind.toLowerCase().replace(/\s+/g, "-")}-${m.numero}.pdf`);
}
