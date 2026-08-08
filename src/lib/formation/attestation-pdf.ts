import jsPDF from "jspdf";
import { applyLigneoFonts } from "@/lib/pdf-fonts";

export type AttestationData = {
  fullName: string;
  userId: string;
  completedAt: Date;
  modulesCount: number;
};

export function attestationReference(userId: string, at: Date) {
  return `LIGNEO-${userId.slice(0, 8).toUpperCase()}-${Math.floor(at.getTime() / 1000)}`;
}

export function generateAttestationPdf(data: AttestationData) {
  const ref = attestationReference(data.userId, data.completedAt);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  applyLigneoFonts(doc);
  doc.setFillColor(11, 19, 56);
  doc.rect(0, 0, 297, 210, "F");
  doc.setDrawColor(184, 134, 42);
  doc.setLineWidth(1.5);
  doc.rect(10, 10, 277, 190);

  doc.setTextColor(231, 199, 106);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TRANSPORTS LIGNEO", 148.5, 32, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(30);
  doc.text("Attestation de formation interne", 148.5, 62, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("Nous attestons que", 148.5, 82, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(data.fullName || "Convoyeur Ligneo", 148.5, 100, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(
    `a suivi et validé l'intégralité du parcours de formation interne convoyeur (${data.modulesCount} modules),`,
    148.5,
    116,
    { align: "center" },
  );
  doc.text("incluant la conformité documentaire, les états des lieux et la sécurité en convoyage.", 148.5, 124, {
    align: "center",
  });

  doc.setTextColor(231, 199, 106);
  doc.setFontSize(11);
  doc.text(`Référence : ${ref}`, 148.5, 152, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.text(`Délivrée le ${data.completedAt.toLocaleDateString("fr-FR")}`, 148.5, 160, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(200, 205, 220);
  doc.text("Document interne — Transports Ligneo · 07 82 45 61 81", 148.5, 194, { align: "center" });

  doc.save(`attestation-formation-${ref}.pdf`);
  return ref;
}
