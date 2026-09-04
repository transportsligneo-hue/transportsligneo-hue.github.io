import { COST_CATEGORIES } from "./fleet-tco.functions";

const catLabel = (id: string) => COST_CATEGORIES.find((c) => c.id === id)?.label ?? id;

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export type ExportCost = {
  date_cout: string;
  categorie: string;
  libelle: string | null;
  montant: number;
  source: string;
  statut: string;
  kilometrage: number | null;
};

export function costsToCsv(rows: ExportCost[]): string {
  const head = ["Date", "Poste", "Libellé", "Montant EUR", "Source", "Statut", "Kilométrage"];
  const body = rows.map((r) =>
    [r.date_cout, catLabel(r.categorie), r.libelle ?? "", Number(r.montant).toFixed(2), r.source, r.statut, r.kilometrage ?? ""]
      .map(esc)
      .join(";"),
  );
  return [head.join(";"), ...body].join("\n");
}

export type ExportVehicle = {
  immatriculation: string | null;
  marque: string | null;
  modele: string | null;
  kilometrage: number;
  total: number;
  tco_km: number | null;
};

export function fleetToCsv(rows: ExportVehicle[]): string {
  const head = ["Immatriculation", "Marque", "Modèle", "Kilométrage", "TCO EUR", "Coût / km EUR"];
  const body = rows.map((r) =>
    [
      r.immatriculation ?? "",
      r.marque ?? "",
      r.modele ?? "",
      r.kilometrage ?? 0,
      Number(r.total).toFixed(2),
      r.tco_km != null ? Number(r.tco_km).toFixed(3) : "",
    ]
      .map(esc)
      .join(";"),
  );
  return [head.join(";"), ...body].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM UTF-8 pour Excel FR
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w.\-]+/g, "-");
  a.click();
  URL.revokeObjectURL(url);
}

/** Rapport PDF de synthèse du parc (jsPDF chargé à la demande). */
export async function downloadFleetPdf(opts: {
  orgName: string;
  periode: string;
  total: number;
  parCategorie: Record<string, number>;
  vehicules: ExportVehicle[];
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const eur = (n: number) => `${Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} EUR`;

  doc.setFillColor(11, 16, 38);
  doc.rect(0, 0, 595, 96, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Rapport TCO - Parc vehicules", 40, 44);
  doc.setFontSize(10);
  doc.setTextColor(212, 175, 55);
  doc.text(`${opts.orgName} · ${opts.periode}`, 40, 66);

  doc.setTextColor(20, 22, 28);
  doc.setFontSize(12);
  doc.text(`Cout total de possession : ${eur(opts.total)}`, 40, 132);

  let y = 162;
  doc.setFontSize(10);
  doc.text("Repartition par poste", 40, y);
  y += 16;
  for (const [k, v] of Object.entries(opts.parCategorie).filter(([, x]) => Number(x) !== 0)) {
    doc.text(`${catLabel(k)}`, 52, y);
    doc.text(eur(Number(v)), 400, y);
    y += 14;
    if (y > 760) { doc.addPage(); y = 60; }
  }

  y += 18;
  doc.text("Detail par vehicule", 40, y);
  y += 16;
  doc.setFontSize(9);
  doc.text("Immat.", 52, y);
  doc.text("Vehicule", 150, y);
  doc.text("Km", 330, y);
  doc.text("TCO", 400, y);
  doc.text("EUR/km", 480, y);
  y += 12;
  for (const v of opts.vehicules) {
    doc.text(String(v.immatriculation ?? "-"), 52, y);
    doc.text([v.marque, v.modele].filter(Boolean).join(" ").slice(0, 28) || "-", 150, y);
    doc.text(String(v.kilometrage ?? 0), 330, y);
    doc.text(eur(v.total), 400, y);
    doc.text(v.tco_km != null ? Number(v.tco_km).toFixed(3) : "-", 480, y);
    y += 13;
    if (y > 780) { doc.addPage(); y = 60; }
  }

  doc.save(`rapport-tco-${opts.orgName.replace(/[^\w]+/g, "-").toLowerCase()}.pdf`);
}
