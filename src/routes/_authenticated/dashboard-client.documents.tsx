import { createFileRoute } from "@tanstack/react-router";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, Receipt, Download } from "lucide-react";
import { toast } from "sonner";
import ClientVehicleDocsCard from "@/components/dashboard/ClientVehicleDocsCard";
import { generateFacturePdf, downloadFacturePdf, type FactureData } from "@/lib/facture-pdf";

export const Route = createFileRoute("/_authenticated/dashboard-client/documents")({
  component: ClientDocuments,
});

interface DocRow {
  mission_id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
}

interface FactRow {
  id: string;
  numero: string;
  statut: string;
  prix_ttc: number;
  date_facture: string | null;
  mode_paiement: string | null;
  paid_at: string | null;
}

const FACT_STATUT: Record<string, { label: string; cls: string }> = {
  emise: { label: "À régler", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  payee: { label: "Payée", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  en_retard: { label: "En retard", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  annulee: { label: "Annulée", cls: "bg-cream/10 text-cream/60 border-cream/20" },
};

function ClientDocuments() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<DocRow[]>([]);
  const [factures, setFactures] = useState<FactRow[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // Le filtrage est assuré par les règles de sécurité (identifiant OU e-mail),
      // un filtre client sur user_id masquerait les dossiers créés par l'admin.
      const [mRes, fRes] = await Promise.all([
        supabase
          .from("missions")
          .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut")
          .order("date_prise_en_charge", { ascending: false }),
        supabase
          .from("factures")
          .select("id, numero, statut, prix_ttc, date_facture, mode_paiement, paid_at")
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const rows = (mRes.data ?? []).filter((m) => !["annulee", "annule", "brouillon"].includes(m.statut ?? ""));
      setMissions(rows.map(m => ({
        mission_id: m.id,
        numero: m.numero,
        ville_depart: m.ville_depart,
        ville_arrivee: m.ville_arrivee,
        date_prise_en_charge: m.date_prise_en_charge,
      })));
      setFactures((fRes.data ?? []) as FactRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleDownloadFacture = async (f: FactRow) => {
    setDownloadingId(f.id);
    try {
      const { data: full } = await supabase.from("factures").select("*").eq("id", f.id).maybeSingle();
      if (!full) throw new Error("Facture introuvable");
      const blob = await generateFacturePdf({
        ...(full as unknown as FactureData),
        prix_ht: Number(full.prix_ht),
        tva_taux: Number(full.tva_taux),
        prix_tva: Number(full.prix_tva),
        prix_ttc: Number(full.prix_ttc),
      });
      downloadFacturePdf(blob, full.numero);
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    } finally {
      setDownloadingId(null);
    }
  };


  return (
    <div className="space-y-6">
      <ClientPageHeader
        breadcrumb="Mes documents"
        eyebrow="Pièces & justificatifs"
        title="Mes"
        highlight="documents"
        subtitle="Factures, attestations et photos d'état des lieux de vos convoyages."
      />

      {user ? <ClientVehicleDocsCard userId={user.id} /> : null}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : missions.length === 0 ? (
        <div className="card-premium p-10 rounded text-center">
          <FileText className="text-cream/20 mx-auto mb-3" size={36} />
          <p className="text-cream/50 text-sm">Aucun document disponible pour le moment.</p>
          <p className="text-cream/30 text-xs mt-2">Les documents apparaîtront ici une fois vos missions démarrées.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map((m) => (
            <div key={m.mission_id} className="card-premium p-5 rounded">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p className="text-cream/40 text-[10px] uppercase tracking-wider">{m.numero}</p>
                  <p className="text-cream font-heading text-sm mt-1">{m.ville_depart} → {m.ville_arrivee}</p>
                </div>
                <span className="text-cream/50 text-xs">{new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="text-cream/40 text-xs italic">
                Documents et photos d'état des lieux disponibles dès l'attribution d'un convoyeur.
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
