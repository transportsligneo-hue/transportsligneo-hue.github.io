import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CreditCard, FileText, X, FileCheck2, Download, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DevisEmbeddedCheckout } from "@/components/devis/DevisEmbeddedCheckout";
import { VehiculeDocsStep } from "@/components/devis/VehiculeDocsStep";
import { DevisAcceptationStep } from "@/components/devis/DevisAcceptationStep";
import { generateFacturePdf, downloadFacturePdf, type FactureData } from "@/lib/facture-pdf";
import { getDevisAcceptationStatus } from "@/lib/devis-acceptation.functions";
import { useServerFn } from "@tanstack/react-start";

type DevisRow = {
  id: string;
  numero: string;
  depart: string;
  arrivee: string;
  prix_estime: number;
  statut: string;
  paid_at: string | null;
  created_at: string;
  date_souhaitee: string | null;
  vin: string | null;
  carte_grise_recto_url: string | null;
  carte_grise_verso_url: string | null;
  vehicule_docs_completed: boolean;
};

type FactureRow = {
  id: string;
  numero: string;
  statut: string;
  type_facture: "particulier" | "b2b";
  date_facture: string | null;
  date_paiement: string | null;
  client_nom: string | null;
  client_prenom: string | null;
  client_societe: string | null;
  client_email: string | null;
  client_adresse: string | null;
  client_siret: string | null;
  client_tva: string | null;
  designation: string | null;
  depart: string | null;
  arrivee: string | null;
  distance_km: number | null;
  prix_ht: number;
  tva_taux: number;
  prix_tva: number;
  prix_ttc: number;
  pdf_url: string | null;
  mode_paiement: string | null;
};

export const Route = createFileRoute("/_authenticated/dashboard-client/devis")({
  component: MesFacturesEtDevis,
});

const STATUT_LABELS: Record<string, { label: string; cls: string }> = {
  envoye: { label: "En attente validation", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  accepte: { label: "Validé — à payer", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  convertit: { label: "Converti en mission", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  refuse: { label: "Refusé", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const FACT_STATUT_LABELS: Record<string, { label: string; cls: string }> = {
  emise: { label: "À régler", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  payee: { label: "Payée", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  en_retard: { label: "En retard", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  annulee: { label: "Annulée", cls: "bg-cream/10 text-cream/60 border-cream/20" },
};

function MesFacturesEtDevis() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"devis" | "factures">("devis");
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [factures, setFactures] = useState<FactureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [step, setStep] = useState<"acceptation" | "docs" | "pay">("acceptation");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const getStatus = useServerFn(getDevisAcceptationStatus);

  const refresh = async () => {
    if (!user) return;
    const authEmail = (user.email ?? "").toLowerCase();
    // On regarde aussi l'email du profil (parfois différent de l'auth)
    const { data: prof } = await supabase
      .from("profiles").select("email").eq("user_id", user.id).maybeSingle();
    const profEmail = (prof?.email ?? "").toLowerCase();
    const emails = Array.from(new Set([authEmail, profEmail].filter(Boolean)));

    const [dRes, fRes] = await Promise.all([
      supabase
        .from("devis")
        .select("id, numero, depart, arrivee, prix_estime, statut, paid_at, created_at, date_souhaitee, vin, carte_grise_recto_url, carte_grise_verso_url, vehicule_docs_completed")
        .or(`user_id.eq.${user.id}${emails.length ? `,${emails.map(e => `email.eq.${e}`).join(",")}` : ""}`)
        .order("created_at", { ascending: false }),
      emails.length > 0
        ? supabase
            .from("factures")
            .select("*")
            .in("client_email", emails)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as FactureRow[] }),
    ]);
    setDevis((dRes.data ?? []) as DevisRow[]);
    setFactures((fRes.data ?? []) as FactureRow[]);
    setLoading(false);
  };


  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const active = devis.find(d => d.id === activeId);
  const returnUrl = typeof window !== "undefined"
    ? `${window.location.origin}/dashboard-client/devis?paye=1`
    : "/";

  const startPayment = async (d: DevisRow) => {
    setActiveId(d.id);
    try {
      const status = await getStatus({ data: { devisId: d.id } });
      if (status.requiresAcceptation) {
        setStep("acceptation");
      } else {
        setStep(d.vehicule_docs_completed ? "pay" : "docs");
      }
    } catch {
      setStep(d.vehicule_docs_completed ? "pay" : "docs");
    }
  };

  const handleDownloadFacture = async (f: FactureRow) => {
    setDownloadingId(f.id);
    try {
      if (f.pdf_url) {
        window.open(f.pdf_url, "_blank");
        return;
      }
      const blob = await generateFacturePdf({
        numero: f.numero,
        type_facture: f.type_facture,
        date_facture: f.date_facture ?? undefined,
        date_paiement: f.date_paiement,
        statut: f.statut,
        client_nom: f.client_nom,
        client_prenom: f.client_prenom,
        client_societe: f.client_societe,
        client_email: f.client_email,
        client_adresse: f.client_adresse,
        client_siret: f.client_siret,
        client_tva: f.client_tva,
        designation: f.designation,
        depart: f.depart,
        arrivee: f.arrivee,
        distance_km: f.distance_km,
        prix_ht: Number(f.prix_ht),
        tva_taux: Number(f.tva_taux),
        prix_tva: Number(f.prix_tva),
        prix_ttc: Number(f.prix_ttc),
        mode_paiement: f.mode_paiement,
      } as FactureData);
      downloadFacturePdf(blob, f.numero);
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Factures &amp; devis</h1>
        <p className="text-cream/50 text-sm mt-1">Validez vos devis et téléchargez vos factures</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-primary/15">
        {([
          { key: "devis", label: `Mes devis (${devis.length})`, icon: FileText },
          { key: "factures", label: `Mes factures (${factures.length})`, icon: Receipt },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              tab === t.key
                ? "text-primary border-primary"
                : "text-cream/50 border-transparent hover:text-cream/80"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "devis" && (
        devis.length === 0 ? (
          <div className="card-premium rounded p-8 text-center">
            <FileText className="mx-auto text-cream/30 mb-3" size={40} />
            <p className="text-cream/60">Aucun devis pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devis.map((d) => {
              const status = STATUT_LABELS[d.statut] ?? { label: d.statut, cls: "bg-cream/10 text-cream/60 border-cream/20" };
              const payable = d.statut === "accepte" && !d.paid_at;
              return (
                <div key={d.id} className="card-premium rounded p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded border bg-primary/15 text-primary border-primary/40 font-heading tracking-wider uppercase">Devis</span>
                      <span className="text-cream/40 text-xs uppercase tracking-wider">{d.numero}</span>
                      <span className={`text-xs px-2 py-1 rounded border ${status.cls}`}>{status.label}</span>
                      {d.paid_at && <span className="text-xs px-2 py-1 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Payé</span>}
                      {payable && d.vehicule_docs_completed && (
                        <span className="text-xs px-2 py-1 rounded border bg-blue-500/15 text-blue-300 border-blue-500/30 inline-flex items-center gap-1">
                          <FileCheck2 size={11} /> Docs OK
                        </span>
                      )}
                    </div>
                    <p className="text-cream font-heading text-base mt-1 truncate">{d.depart} → {d.arrivee}</p>
                    <p className="text-cream/50 text-xs mt-1">
                      {d.date_souhaitee ? new Date(d.date_souhaitee).toLocaleDateString("fr-FR") : "Date à confirmer"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-heading text-xl text-primary whitespace-nowrap">{Number(d.prix_estime).toFixed(2)} €</p>
                    {payable && (
                      <button
                        onClick={() => startPayment(d)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-navy font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors rounded"
                      >
                        {d.vehicule_docs_completed ? <CreditCard size={14} /> : <FileCheck2 size={14} />}
                        {d.vehicule_docs_completed ? "Payer" : "Compléter & payer"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "factures" && (
        factures.length === 0 ? (
          <div className="card-premium rounded p-8 text-center">
            <Receipt className="mx-auto text-cream/30 mb-3" size={40} />
            <p className="text-cream/60">Aucune facture émise pour le moment.</p>
            <p className="text-cream/40 text-xs mt-1">Les factures apparaissent ici une fois la mission terminée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {factures.map((f) => {
              const st = FACT_STATUT_LABELS[f.statut] ?? { label: f.statut, cls: "bg-cream/10 text-cream/60 border-cream/20" };
              return (
                <div key={f.id} className="card-premium rounded p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-heading tracking-wider uppercase">Facture</span>
                      <span className="text-cream/40 text-xs uppercase tracking-wider">{f.numero}</span>
                      <span className={`text-xs px-2 py-1 rounded border ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-cream font-heading text-base mt-1 truncate">{f.depart} → {f.arrivee}</p>
                    <p className="text-cream/50 text-xs mt-1">
                      {f.date_facture ? new Date(f.date_facture).toLocaleDateString("fr-FR") : "—"}
                      {f.distance_km ? ` · ${f.distance_km} km` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-heading text-xl text-primary">{Number(f.prix_ttc).toFixed(2)} €</p>
                      <p className="text-cream/40 text-[10px]">TTC ({Number(f.prix_ht).toFixed(2)} € HT)</p>
                    </div>
                    <button
                      onClick={() => handleDownloadFacture(f)}
                      disabled={downloadingId === f.id}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-navy font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors rounded disabled:opacity-50"
                    >
                      {downloadingId === f.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {active && (
        <div className="fixed inset-0 bg-navy/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
          <div className="bg-navy-dark border border-primary/30 rounded-xl max-w-2xl w-full p-6 my-8 relative">
            <button
              onClick={() => setActiveId(null)}
              className="absolute top-4 right-4 text-cream/60 hover:text-cream transition-colors"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <div className="mb-4">
              <h2 className="font-heading text-xl text-primary tracking-wider">
                {step === "docs" ? "Documents véhicule" : "Paiement"} — {active.numero}
              </h2>
              <p className="text-cream/60 text-sm mt-1">{active.depart} → {active.arrivee} · {Number(active.prix_estime).toFixed(2)} €</p>

              <div className="flex items-center gap-2 mt-4 text-[11px] uppercase tracking-wider">
                <div className={`flex items-center gap-1.5 ${step === "docs" ? "text-primary" : "text-emerald-400"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === "docs" ? "bg-primary text-navy" : "bg-emerald-500/20"}`}>
                    {step === "docs" ? "1" : "✓"}
                  </span>
                  Documents
                </div>
                <div className="h-px flex-1 bg-cream/10" />
                <div className={`flex items-center gap-1.5 ${step === "pay" ? "text-primary" : "text-cream/40"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === "pay" ? "bg-primary text-navy" : "bg-cream/10"}`}>2</span>
                  Paiement
                </div>
              </div>
            </div>

            {step === "docs" ? (
              <VehiculeDocsStep
                devisId={active.id}
                initialVin={active.vin}
                initialRectoUrl={active.carte_grise_recto_url}
                initialVersoUrl={active.carte_grise_verso_url}
                onCompleted={() => {
                  setStep("pay");
                  refresh();
                }}
              />
            ) : (
              <DevisEmbeddedCheckout devisId={active.id} returnUrl={returnUrl} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
