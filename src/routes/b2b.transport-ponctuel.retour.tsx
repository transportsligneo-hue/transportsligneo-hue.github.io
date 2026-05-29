import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, ArrowLeft, MapPin, Calendar, Clock, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";


export const Route = createFileRoute("/b2b/transport-ponctuel/retour")({
  component: RetourPage,
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Paiement confirmé | Transports Ligneo" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

interface RequestRow {
  numero: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_date: string;
  scheduled_time: string;
  estimated_price_ttc: number | null;
  vehicle_type: string;
  urgency: string;
  payment_status: string;
}

function RetourPage() {
  const { session_id } = useSearch({ from: "/b2b/transport-ponctuel/retour" });
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchAndPoll() {
      if (!session_id) { setLoading(false); return; }
      for (let i = 0; i < 5; i++) {
        try {
          const res = await fetch(`/api/public/b2b/session-status?session_id=${encodeURIComponent(session_id)}`);
          const json = await res.json();
          if (cancelled) return;
          if (json?.request) {
            setRequest(json.request as RequestRow);
            if (json.request.payment_status === "paid") break;
          }
        } catch (err) {
          console.warn("[b2b retour] fetch failed", err);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setLoading(false);
    }
    void fetchAndPoll();
    return () => { cancelled = true; };
  }, [session_id]);

  return (
    <div className="min-h-screen bg-[#faf7ef]">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-[#e7c76a]/30 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e7c76a]/15">
            <CheckCircle2 className="h-9 w-9 text-[#b8860b]" />
          </div>
          <h1 className="text-2xl font-bold text-[#0b1026]">Paiement confirmé</h1>
          <p className="mt-2 text-[#0b1026]/65">
            Votre demande de transport B2B a bien été enregistrée. Notre équipe vous contacte sous 24h pour la planification opérationnelle.
          </p>

          {loading && !request && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#0b1026]/55">
              <Loader2 className="h-4 w-4 animate-spin" /> Confirmation en cours…
            </div>
          )}

          {request && (
            <div className="mt-6 rounded-lg border border-[#0b1026]/10 bg-[#faf7ef] p-5 text-left">
              <div className="flex items-center justify-between border-b border-[#0b1026]/10 pb-3">
                <span className="font-mono text-xs text-[#0b1026]/55">{request.numero}</span>
                <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                  request.payment_status === "paid"
                    ? "bg-[#e7c76a]/15 text-emerald-800"
                    : "bg-[#e7c76a]/15 text-amber-800"
                }`}>
                  {request.payment_status === "paid" ? "Payé" : "En attente"}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-[#0b1026]/45" />
                  <div>
                    <div className="text-[#0b1026]/80">{request.pickup_address}</div>
                    <div className="text-[#0b1026]/55">→ {request.dropoff_address}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[#0b1026]/65">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{request.scheduled_date}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{request.scheduled_time}</span>
                </div>
                {request.estimated_price_ttc && (
                  <div className="border-t border-[#0b1026]/10 pt-2 text-right">
                    <span className="text-xs text-[#0b1026]/55">Total TTC</span>
                    <div className="text-lg font-bold text-[#0b1026]">
                      {Number(request.estimated_price_ttc).toFixed(2)} €
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {session_id && (
            <p className="mt-4 text-xs text-[#0b1026]/45">Référence Stripe : {session_id.slice(0, 18)}…</p>
          )}
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/b2b"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#0b1026]/10 bg-white px-4 py-2 text-sm text-[#0b1026]/80 hover:bg-[#faf7ef]"
            >
              <ArrowLeft className="h-4 w-4" /> Solutions B2B
            </Link>
            <Link
              to="/b2b/transport-ponctuel"
              className="rounded-md bg-[#d4af37] px-4 py-2 text-sm font-medium text-white hover:bg-[#b8860b]"
            >
              Nouvelle demande
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
