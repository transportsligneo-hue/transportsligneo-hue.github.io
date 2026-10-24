import jsPDF from "jspdf";

export type AttestationData = {
  fullName: string;
  userId: string;
  completedAt: Date;
  modulesCount: number;
};

export function attestationReference(userId: string, at: Date) {
  return `LIGNEO-${userId.slice(0, 8).toUpperCase()}-${Math.floor(at.getTime() / 1000)}`;
}

const NAVY: [number, number, number] = [11, 19, 56];
const GREEN: [number, number, number] = [20, 184, 102];
const GOLD: [number, number, number] = [184, 134, 42];
const GREY: [number, number, number] = [96, 106, 130];

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/logo-ligneo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Génère l'attestation (PDF A4 paysage, sobre et institutionnelle) et renvoie le fichier + sa référence. */
export async function buildAttestationPdf(data: AttestationData): Promise<{ blob: Blob; filename: string; ref: string }> {
  const ref = attestationReference(data.userId, data.completedAt);
  const logo = await loadLogo();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, cx = W / 2;

  // Fond blanc + cadre double (marine / or)
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 7, "F"); doc.rect(0, H - 7, W, 7, "F");
  doc.setFillColor(...GREEN); doc.rect(0, 7, W, 1.2, "F"); doc.rect(0, H - 8.2, W, 1.2, "F");
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.rect(14, 16, W - 28, H - 32);
  doc.setLineWidth(0.15); doc.rect(16, 18, W - 32, H - 36);
  // Ornements d'angle
  doc.setFillColor(...GOLD);
  for (const [x, y] of [[14, 16], [W - 14, 16], [14, H - 16], [W - 14, H - 16]]) doc.circle(x, y, 1.6, "F");

  // En-tête : logo + raison sociale
  if (logo) { try { doc.addImage(logo, "PNG", 24, 24, 20, 20); } catch { /* logo non bloquant */ } }
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY);
  doc.text("TRANSPORTS LIGNEO", logo ? 48 : 24, 32);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GREY);
  doc.text("Convoyage professionnel de véhicules · Tours (37)", logo ? 48 : 24, 38);
  doc.setFontSize(8); doc.text(`Référence  ${ref}`, W - 24, 32, { align: "right" });
  doc.text(`Délivrée le ${data.completedAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`, W - 24, 38, { align: "right" });

  // Titre
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...GOLD);
  doc.text("A T T E S T A T I O N   D E   F O R M A T I O N", cx, 64, { align: "center" });
  doc.setFont("times", "bold"); doc.setFontSize(34); doc.setTextColor(...NAVY);
  doc.text("Certificat Convoyeur Ligneo", cx, 80, { align: "center" });
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.9); doc.line(cx - 22, 86, cx + 22, 86);

  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...GREY);
  doc.text("Transports Ligneo atteste que", cx, 98, { align: "center" });

  // Nom
  doc.setFont("times", "bolditalic"); doc.setFontSize(30); doc.setTextColor(...NAVY);
  const name = data.fullName || "Convoyeur Ligneo";
  doc.text(name, cx, 113, { align: "center" });
  const nw = Math.min(doc.getTextWidth(name) + 16, W - 80);
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.line(cx - nw / 2, 118, cx + nw / 2, 118);

  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(40, 48, 74);
  doc.text(`a suivi avec succès et validé l'intégralité du parcours de formation interne « Convoyeur » (${data.modulesCount} modules).`, cx, 129, { align: "center" });

  // Trois piliers
  const pillars = ["Conformité documentaire", "États des lieux & preuves photo", "Sécurité en convoyage"];
  const pw = 70, gap = 8, x0 = cx - (pw * 3 + gap * 2) / 2;
  pillars.forEach((p, i) => {
    const x = x0 + i * (pw + gap);
    doc.setFillColor(243, 247, 245); doc.setDrawColor(215, 226, 220); doc.setLineWidth(0.2);
    doc.roundedRect(x, 137, pw, 11, 2, 2, "FD");
    doc.setFillColor(...GREEN); doc.circle(x + 6, 142.5, 1.7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.8); doc.setTextColor(...NAVY);
    doc.text(p, x + 11, 143.6);
  });

  // Pied : date / sceau / signature
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.3);
  doc.line(34, 176, 98, 176); doc.line(W - 98, 176, W - 34, 176);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
  doc.text(data.completedAt.toLocaleDateString("fr-FR"), 66, 172, { align: "center" });
  doc.setFont("times", "italic"); doc.setFontSize(15); doc.text("Olivier Gourlaouen", W - 66, 172, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GREY);
  doc.text("Date de validation", 66, 181, { align: "center" });
  doc.text("Responsable d'exploitation · Transports Ligneo", W - 66, 181, { align: "center" });

  // Sceau
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.9); doc.circle(cx, 168, 13);
  doc.setLineWidth(0.25); doc.circle(cx, 168, 11);
  doc.setFillColor(...NAVY); doc.circle(cx, 168, 9.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(231, 199, 106);
  doc.text("TRANSPORTS", cx, 166.4, { align: "center" });
  doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
  doc.text("LIGNEO", cx, 170.4, { align: "center" });
  doc.setFontSize(4.8); doc.setTextColor(231, 199, 106);
  doc.text("CERTIFIÉ", cx, 173.6, { align: "center" });

  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GREY);
  doc.text("Attestation interne de formation — SIREN 753 320 001 · contact@transportsligneo.fr · 07 82 45 61 81 · transportsligneo.fr", cx, H - 12, { align: "center" });

  return { blob: doc.output("blob"), filename: `attestation-formation-${ref}.pdf`, ref };
}

/** Télécharge / partage l'attestation (fonctionne dans l'appli Android comme sur le site). */
export async function generateAttestationPdf(data: AttestationData) {
  const { blob, filename, ref } = await buildAttestationPdf(data);
  const { downloadBlob } = await import("@/lib/documents-officiels");
  await downloadBlob(blob, filename);
  return ref;
}
