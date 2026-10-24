import jsPDF from "jspdf";
import { COMPANY_SIGNATURE_LAYOUT, loadCompanySignature } from "@/lib/pdf-company-signature";

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
  const [logo, company] = await Promise.all([loadLogo(), loadCompanySignature().catch(() => null)]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, cx = W / 2;

  // Papier crème + filigrane + cadre guilloché de type diplôme
  doc.setFillColor(253, 251, 245); doc.rect(0, 0, W, H, "F");
  if (logo) {
    try {
      const d = doc as unknown as { GState: new (o: { opacity: number }) => unknown; setGState: (g: unknown) => void };
      doc.setGState(new d.GState({ opacity: 0.06 })); doc.addImage(logo, "PNG", cx - 52, 52, 104, 104); doc.setGState(new d.GState({ opacity: 1 }));
    } catch { /* filigrane non bloquant */ }
  }
  // Bande guillochée (ondes entrelacées) entre deux filets
  const gx0 = 9, gy0 = 9, gw = W - 18, gh = H - 18;
  doc.setFillColor(...NAVY); doc.rect(6, 6, W - 12, H - 12, "F");
  doc.setFillColor(253, 251, 245); doc.rect(gx0 + 6, gy0 + 6, gw - 12, gh - 12, "F");
  doc.setLineWidth(0.12);
  for (let k = 0; k < 3; k++) {
    doc.setDrawColor(...(k === 1 ? GOLD : [60, 78, 150] as [number, number, number]));
    const ph = k * 2.1;
    const pts = (n: number, f: (t: number) => [number, number]) => { let prev = f(0); for (let i = 1; i <= n; i++) { const c = f(i / n); doc.line(prev[0], prev[1], c[0], c[1]); prev = c; } };
    pts(320, (t) => [gx0 + t * gw, gy0 + 3 + 2.1 * Math.sin(t * 60 + ph)]);
    pts(320, (t) => [gx0 + t * gw, gy0 + gh - 3 + 2.1 * Math.sin(t * 60 + ph)]);
    pts(220, (t) => [gx0 + 3 + 2.1 * Math.sin(t * 42 + ph), gy0 + t * gh]);
    pts(220, (t) => [gx0 + gw - 3 + 2.1 * Math.sin(t * 42 + ph), gy0 + t * gh]);
  }
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.rect(gx0 + 6, gy0 + 6, gw - 12, gh - 12);
  doc.setLineWidth(0.15); doc.rect(gx0 + 8, gy0 + 8, gw - 16, gh - 16);
  // Ornements d'angle (rosaces)
  for (const [x, y] of [[gx0 + 6, gy0 + 6], [gx0 + gw - 6, gy0 + 6], [gx0 + 6, gy0 + gh - 6], [gx0 + gw - 6, gy0 + gh - 6]]) {
    doc.setFillColor(...NAVY); doc.circle(x, y, 4.2, "F");
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.circle(x, y, 3.2); doc.circle(x, y, 1.6);
    doc.setFillColor(...GOLD); doc.circle(x, y, 0.7, "F");
  }

  // En-tête : logo + raison sociale
  if (logo) { try { doc.addImage(logo, "PNG", 27, 27, 18, 18); } catch { /* logo non bloquant */ } }
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY);
  doc.text("TRANSPORTS LIGNEO", logo ? 49 : 27, 33);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GREY);
  doc.text("Convoyage professionnel de véhicules · Tours (37)", logo ? 49 : 27, 39);
  doc.setFontSize(8); doc.text(`Certificat n° ${ref}`, W - 27, 33, { align: "right" });
  doc.text(`Délivrée le ${data.completedAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`, W - 27, 39, { align: "right" });

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
    doc.roundedRect(x, 133, pw, 11, 2, 2, "FD");
    doc.setFillColor(...GREEN); doc.circle(x + 6, 138.5, 1.7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.8); doc.setTextColor(...NAVY);
    doc.text(p, x + 11, 139.6);
  });

  // Pied : date / sceau / signature
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.3);
  doc.line(42, 176, 100, 176); doc.line(W - 100, 176, W - 42, 176);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
  doc.text(data.completedAt.toLocaleDateString("fr-FR"), 71, 172, { align: "center" });
  if (company) {
    // Même composition que le contrat convoyeur : tampon + grande signature par-dessus
    const k = 1.15, lay = COMPANY_SIGNATURE_LAYOUT, sigH = 34, sigW = (sigH * 894) / 672;
    const sx = W - 71 - (lay.stampWidth * k) / 2, sy2 = 158;
    if (company.stampData) doc.addImage(company.stampData, "PNG", sx, sy2, lay.stampWidth * k, lay.stampHeight * k, "tampon-ligneo-attestation", "FAST", lay.rotation);
    if (company.signatureData) doc.addImage(company.signatureData, "PNG", sx + 4, sy2 - 13, sigW, sigH, "signature-ligneo-attestation", "FAST");
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GREY);
  doc.text("Date de validation", 71, 181, { align: "center" });
  doc.text("Olivier Gourlaouen · Responsable d'exploitation, Transports Ligneo", W - 71, 181, { align: "center" });

  // Sceau doré en relief + rubans
  const sy = 164;
  doc.setFillColor(...NAVY);
  doc.triangle(cx - 9, sy + 8, cx - 3, sy + 10, cx - 12, sy + 19, "F"); doc.triangle(cx - 12, sy + 19, cx - 3, sy + 10, cx - 3, sy + 16, "F");
  doc.triangle(cx + 9, sy + 8, cx + 3, sy + 10, cx + 12, sy + 19, "F"); doc.triangle(cx + 12, sy + 19, cx + 3, sy + 10, cx + 3, sy + 16, "F");
  const star: number[][] = [];
  for (let i = 0; i < 48; i++) { const r = i % 2 ? 13.2 : 15; const an = (i / 48) * Math.PI * 2; star.push([cx + r * Math.cos(an), sy + r * Math.sin(an)]); }
  doc.setFillColor(...GOLD);
  doc.lines(star.slice(1).map((p, i) => [p[0] - star[i][0], p[1] - star[i][1]]), star[0][0], star[0][1], [1, 1], "F", true);
  doc.setFillColor(231, 199, 106); doc.circle(cx, sy, 12, "F");
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.3); doc.circle(cx, sy, 11); doc.circle(cx, sy, 8.6);
  doc.setFillColor(...NAVY); doc.circle(cx, sy, 8.2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(5.6); doc.setTextColor(231, 199, 106);
  doc.text("TRANSPORTS", cx, sy - 2, { align: "center" });
  doc.setFontSize(8); doc.setTextColor(255, 255, 255); doc.text("LIGNEO", cx, sy + 2, { align: "center" });
  doc.setFontSize(4.4); doc.setTextColor(231, 199, 106); doc.text("CERTIFIÉ", cx, sy + 5.2, { align: "center" });

  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GREY);
  doc.text("Attestation interne de formation — SIREN 753 320 001 · contact@transportsligneo.fr · 07 82 45 61 81 · transportsligneo.fr", cx, H - 19.5, { align: "center" });

  return { blob: doc.output("blob"), filename: `attestation-formation-${ref}.pdf`, ref };
}

/** Télécharge / partage l'attestation (fonctionne dans l'appli Android comme sur le site). */
export async function generateAttestationPdf(data: AttestationData) {
  const { blob, filename, ref } = await buildAttestationPdf(data);
  const { downloadBlob } = await import("@/lib/documents-officiels");
  await downloadBlob(blob, filename);
  return ref;
}
