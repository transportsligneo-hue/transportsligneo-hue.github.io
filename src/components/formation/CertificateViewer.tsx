import { useEffect, useState } from "react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { Download, ShieldCheck, ArrowLeft } from "lucide-react";

type Certificate = {
  id: string;
  certificate_number: string;
  full_name: string;
  issued_at: string;
  verification_token: string;
};

export function CertificateViewer({ cert, onBack }: { cert: Certificate; onBack: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const verifyUrl = typeof window !== "undefined" ? `${window.location.origin}/verify-certificat/${cert.verification_token}` : "";

  useEffect(() => {
    if (!verifyUrl) return;
    QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 }).then(setQr).catch(() => setQr(null));
  }, [verifyUrl]);

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFillColor(11, 16, 38);
    doc.rect(0, 0, 297, 210, "F");
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(2);
    doc.rect(10, 10, 277, 190);
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TRANSPORTS LIGNEO", 148.5, 30, { align: "center" });
    doc.setTextColor(250, 247, 239);
    doc.setFontSize(36);
    doc.text("Certificat de Convoyeur", 148.5, 60, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Ce certificat atteste que", 148.5, 80, { align: "center" });
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text(cert.full_name, 148.5, 100, { align: "center" });
    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.text("a validé avec succès la formation obligatoire", 148.5, 115, { align: "center" });
    doc.text("Transports Ligneo et est certifié pour effectuer des missions de convoyage.", 148.5, 123, { align: "center" });
    doc.setFontSize(11);
    doc.setTextColor(212, 175, 55);
    doc.text(`N° ${cert.certificate_number}`, 148.5, 150, { align: "center" });
    doc.setTextColor(250, 247, 239);
    doc.text(`Délivré le ${new Date(cert.issued_at).toLocaleDateString("fr-FR")}`, 148.5, 158, { align: "center" });
    if (qr) {
      try {
        doc.addImage(qr, "PNG", 235, 155, 35, 35);
      } catch {
        /* ignore */
      }
    }
    doc.setFontSize(9);
    doc.text(`Vérification : ${verifyUrl}`, 148.5, 200, { align: "center" });
    doc.save(`certificat-${cert.certificate_number}.pdf`);
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-pro-accent hover:underline flex items-center gap-1">
        <ArrowLeft size={14} /> Retour à l'académie
      </button>
      <div className="rounded-2xl overflow-hidden shadow-pro-card border border-pro-border">
        <div className="bg-gradient-to-br from-[#0b1026] to-[#111a3d] p-10 text-center relative">
          <div className="absolute inset-4 border-2 border-[#d4af37] rounded-xl pointer-events-none" />
          <p className="text-[#d4af37] text-xs uppercase tracking-[0.3em] font-semibold">Transports Ligneo</p>
          <h1 className="text-4xl font-serif text-[#faf7ef] mt-6" style={{ fontFamily: "'Playfair Display', serif" }}>
            Certificat de Convoyeur
          </h1>
          <p className="text-[#faf7ef]/80 text-sm mt-6">Ce certificat atteste que</p>
          <p className="text-3xl font-bold text-[#faf7ef] mt-3">{cert.full_name}</p>
          <p className="text-[#faf7ef]/80 text-sm mt-4 max-w-lg mx-auto">
            a validé avec succès la formation obligatoire Transports Ligneo et est certifié pour effectuer des missions de convoyage.
          </p>
          <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
            <div className="text-left">
              <p className="text-[#d4af37] text-xs uppercase tracking-wider">N° certificat</p>
              <p className="text-[#faf7ef] font-mono text-sm mt-0.5">{cert.certificate_number}</p>
              <p className="text-[#d4af37] text-xs uppercase tracking-wider mt-3">Délivré le</p>
              <p className="text-[#faf7ef] text-sm mt-0.5">
                {new Date(cert.issued_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            {qr && <img src={qr} alt="QR de vérification" className="w-28 h-28 rounded bg-white p-1" />}
          </div>
          <p className="text-[#faf7ef]/50 text-[10px] mt-6">Vérifier ce certificat : {verifyUrl}</p>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={downloadPdf}
          className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <Download size={15} /> Télécharger le PDF
        </button>
        <a
          href={verifyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-pro-border px-4 py-2.5 text-sm text-pro-text hover:bg-pro-bg-soft"
        >
          <ShieldCheck size={15} /> Page de vérification publique
        </a>
      </div>
    </div>
  );
}
