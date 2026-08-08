import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, FileText, PenLine, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  PageHeader,
  Card,
  KpiCard,
  Badge,
  EmptyState,
  Button,
  SearchInput,
} from "@/components/admin/AdminUI";
import { LogoLoader } from "@/components/brand/LogoLoader";
import { applyLigneoFonts } from "@/lib/pdf-fonts";

export const Route = createFileRoute("/_authenticated/admin/acceptations")({
  component: AdminAcceptationsPage,
});

interface ProofRow {
  id: string;
  devis_id: string;
  devis_version: number | null;
  client_email: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  montant_accepte: number | null;
  cgv_version: string | null;
  statut: string;
  signature_url: string | null;
  pdf_url: string | null;
  created_at: string;
  devis?: { numero: string; depart: string; arrivee: string; prenom: string; nom: string } | null;
}

function AdminAcceptationsPage() {
  const [rows, setRows] = useState<ProofRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("devis_acceptations")
        .select("*, devis:devis_id(numero, depart, arrivee, prenom, nom)")
        .order("accepted_at", { ascending: false });
      if (error) toast.error("Chargement impossible", { description: error.message });
      setRows((data ?? []) as unknown as ProofRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.client_email.toLowerCase().includes(q) ||
      (r.devis?.numero ?? "").toLowerCase().includes(q) ||
      (r.ip_address ?? "").toLowerCase().includes(q) ||
      `${r.devis?.prenom ?? ""} ${r.devis?.nom ?? ""}`.toLowerCase().includes(q)
    );
  });

  const openProof = async (path: string | null) => {
    if (!path) return;
    const { data } = await supabase.storage.from("devis-acceptes").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Document introuvable");
  };

  const exportCsv = () => {
    const sep = ";";
    const head = ["Devis", "Version", "Client", "Email", "Accepte le", "IP", "Montant TTC", "Version CGV", "Signature", "PDF"].join(sep);
    const lines = filtered.map((r) =>
      [
        r.devis?.numero ?? r.devis_id,
        String(r.devis_version ?? 1),
        `${r.devis?.prenom ?? ""} ${r.devis?.nom ?? ""}`.trim(),
        r.client_email,
        new Date(r.accepted_at).toLocaleString("fr-FR"),
        r.ip_address ?? "",
        r.montant_accepte != null ? Number(r.montant_accepte).toFixed(2) : "",
        r.cgv_version ?? "",
        r.signature_url ? "Oui" : "Non",
        r.pdf_url ? "Oui" : "Non",
      ].join(sep)
    );
    const csv = "\uFEFF" + [head, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preuves-acceptation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    applyLigneoFonts(doc);
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(11, 16, 38);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Transports Ligneo — Registre des preuves d'acceptation de devis", 8, 11);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(`Edite le ${new Date().toLocaleString("fr-FR")} · ${filtered.length} preuve(s)`, pageW - 8, 11, { align: "right" });

    const cols = [
      { label: "Devis", w: 34 },
      { label: "V", w: 8 },
      { label: "Client", w: 44 },
      { label: "Email", w: 58 },
      { label: "Accepte le", w: 34 },
      { label: "IP", w: 30 },
      { label: "Montant", w: 22 },
      { label: "CGV", w: 22 },
      { label: "Sign.", w: 12 },
    ];
    let y = 26;
    const drawHead = () => {
      let x = 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 120);
      cols.forEach((c) => { doc.text(c.label.toUpperCase(), x, y); x += c.w; });
      y += 2;
      doc.setDrawColor(212, 175, 55);
      doc.line(8, y, pageW - 8, y);
      y += 4;
    };
    drawHead();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    filtered.forEach((r) => {
      if (y > 195) {
        doc.addPage();
        y = 16;
        drawHead();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }
      doc.setTextColor(40, 40, 50);
      let x = 8;
      const vals = [
        r.devis?.numero ?? r.devis_id.slice(0, 8),
        String(r.devis_version ?? 1),
        `${r.devis?.prenom ?? ""} ${r.devis?.nom ?? ""}`.trim().slice(0, 26),
        r.client_email.slice(0, 36),
        new Date(r.accepted_at).toLocaleString("fr-FR"),
        r.ip_address ?? "—",
        r.montant_accepte != null ? `${Number(r.montant_accepte).toFixed(2)} EUR` : "—",
        r.cgv_version ?? "—",
        r.signature_url ? "Oui" : "Non",
      ];
      vals.forEach((v, i) => { doc.text(String(v), x, y); x += cols[i].w; });
      y += 5.5;
    });
    doc.save(`preuves-acceptation-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const total = filtered.reduce((s, r) => s + Number(r.montant_accepte ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Preuves d'acceptation"
        subtitle="Registre légal des devis acceptés et signés : horodatage, IP, signature, PDF figé."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Preuves enregistrées" value={filtered.length} icon={PenLine} />
        <KpiCard label="Montant total accepté" value={`${total.toLocaleString("fr-FR")} €`} tone="success" />
        <KpiCard label="Avec PDF figé" value={filtered.filter((r) => r.pdf_url).length} tone="info" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par devis, client, email, IP..." />
        <div className="flex gap-2">
          <Button size="sm" onClick={exportCsv} icon={<FileSpreadsheet size={12} />}>Export CSV</Button>
          <Button size="sm" onClick={exportPdf} icon={<FileText size={12} />}>Export PDF</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LogoLoader label="Chargement des preuves…" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={PenLine}
          title="Aucune preuve d'acceptation"
          description="Les acceptations signées par les clients apparaîtront ici avec leur horodatage, IP et PDF figé."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-mono text-pro-accent text-sm font-semibold">{r.devis?.numero ?? r.devis_id.slice(0, 8)}</span>
                    <Badge tone="success">✍ Signé v{r.devis_version ?? 1}</Badge>
                    <Badge tone="neutral">CGV {r.cgv_version ?? "—"}</Badge>
                  </div>
                  <p className="text-pro-text font-medium">
                    {`${r.devis?.prenom ?? ""} ${r.devis?.nom ?? ""}`.trim() || r.client_email}
                  </p>
                  <p className="text-xs text-pro-text-soft mt-0.5">{r.client_email}</p>
                  {r.devis && (
                    <p className="text-xs text-pro-text-soft mt-0.5">{r.devis.depart} → {r.devis.arrivee}</p>
                  )}
                  <p className="text-[11px] text-pro-text-soft mt-1.5">
                    Accepté le <span className="font-medium text-pro-text">{new Date(r.accepted_at).toLocaleString("fr-FR")}</span>
                    {" · "}IP <span className="font-mono">{r.ip_address ?? "—"}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-xl font-semibold text-pro-text">
                    {r.montant_accepte != null ? `${Number(r.montant_accepte).toFixed(2)} €` : "—"}
                  </p>
                  <div className="flex gap-2">
                    {r.signature_url && (
                      <Button size="sm" onClick={() => openProof(r.signature_url)} icon={<PenLine size={12} />}>
                        Signature
                      </Button>
                    )}
                    {r.pdf_url && (
                      <Button size="sm" onClick={() => openProof(r.pdf_url)} icon={<ExternalLink size={12} />}>
                        PDF signé
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
