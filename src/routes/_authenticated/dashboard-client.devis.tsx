import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CreditCard, FileText, X, FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DevisEmbeddedCheckout } from "@/components/devis/DevisEmbeddedCheckout";
import { VehiculeDocsStep } from "@/components/devis/VehiculeDocsStep";

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

export const Route = createFileRoute("/_authenticated/dashboard-client/devis")({
  component: MesDevis,
});

const STATUT_LABELS: Record<string, { label: string; cls: string }> = {
  envoye: { label: "En attente validation", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  accepte: { label: "Validé — à payer", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  convertit: { label: "Converti en mission", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  refuse: { label: "Refusé", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
};

function MesDevis() {
  const { user } = useAuth();
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [step, setStep] = useState<"docs" | "pay">("docs");

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("devis")
      .select("id, numero, depart, arrivee, prix_estime, statut, paid_at, created_at, date_souhaitee, vin, carte_grise_recto_url, carte_grise_verso_url, vehicule_docs_completed")
      .or(`user_id.eq.${user.id},email.eq.${user.email ?? ""}`)
      .order("created_at", { ascending: false });
    setDevis((data ?? []) as DevisRow[]);
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

  const startPayment = (d: DevisRow) => {
    setActiveId(d.id);
    setStep(d.vehicule_docs_completed ? "pay" : "docs");
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Mes devis</h1>
        <p className="text-cream/50 text-sm mt-1">Validez et payez vos devis en ligne</p>
      </div>

      {devis.length === 0 ? (
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

              {/* Stepper */}
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
