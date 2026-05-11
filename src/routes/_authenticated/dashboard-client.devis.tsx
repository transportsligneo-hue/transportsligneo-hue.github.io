import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CreditCard, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DevisEmbeddedCheckout } from "@/components/devis/DevisEmbeddedCheckout";

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
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("devis")
        .select("id, numero, depart, arrivee, prix_estime, statut, paid_at, created_at, date_souhaitee")
        .or(`user_id.eq.${user.id},email.eq.${user.email ?? ""}`)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setDevis((data ?? []) as DevisRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const payingDevis = devis.find(d => d.id === payingId);
  const returnUrl = typeof window !== "undefined"
    ? `${window.location.origin}/dashboard-client/devis?paye=1`
    : "/";

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
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-cream/40 text-xs uppercase tracking-wider">{d.numero}</span>
                    <span className={`text-xs px-2 py-1 rounded border ${status.cls}`}>{status.label}</span>
                    {d.paid_at && <span className="text-xs px-2 py-1 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Payé</span>}
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
                      onClick={() => setPayingId(d.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-navy font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors rounded"
                    >
                      <CreditCard size={14} /> Payer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {payingDevis && (
        <div className="fixed inset-0 bg-navy/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
          <div className="bg-navy-dark border border-primary/30 rounded-xl max-w-2xl w-full p-6 my-8 relative">
            <button
              onClick={() => setPayingId(null)}
              className="absolute top-4 right-4 text-cream/60 hover:text-cream transition-colors"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <div className="mb-4">
              <h2 className="font-heading text-xl text-primary tracking-wider">Paiement — {payingDevis.numero}</h2>
              <p className="text-cream/60 text-sm mt-1">{payingDevis.depart} → {payingDevis.arrivee} · {Number(payingDevis.prix_estime).toFixed(2)} €</p>
            </div>
            <DevisEmbeddedCheckout devisId={payingDevis.id} returnUrl={returnUrl} />
          </div>
        </div>
      )}
    </div>
  );
}
