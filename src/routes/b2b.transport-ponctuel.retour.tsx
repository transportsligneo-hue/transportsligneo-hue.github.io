import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, ArrowLeft, MapPin, Calendar, Clock, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

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
      // Poll up to ~10s for the webhook to mark the request as paid
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from("b2b_transport_requests")
          .select("numero, pickup_address, dropoff_address, scheduled_date, scheduled_time, estimated_price_ttc, vehicle_type, urgency, payment_status")
          .eq("stripe_session_id", session_id)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          setRequest(data as RequestRow);
          if (data.payment_status === "paid") break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setLoading(false);
    }
    void fetchAndPoll();
    return () => { cancelled = true; };
  }, [session_id]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Paiement confirmé</h1>
          <p className="mt-2 text-slate-600">
            Votre demande de transport B2B a bien été enregistrée. Notre équipe vous contacte sous 24h pour la planification opérationnelle.
          </p>

          {loading && !request && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Confirmation en cours…
            </div>
          )}

          {request && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5 text-left">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="font-mono text-xs text-slate-500">{request.numero}</span>
                <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                  request.payment_status === "paid"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}>
                  {request.payment_status === "paid" ? "Payé" : "En attente"}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <div className="text-slate-700">{request.pickup_address}</div>
                    <div className="text-slate-500">→ {request.dropoff_address}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-slate-600">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{request.scheduled_date}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{request.scheduled_time}</span>
                </div>
                {request.estimated_price_ttc && (
                  <div className="border-t border-slate-200 pt-2 text-right">
                    <span className="text-xs text-slate-500">Total TTC</span>
                    <div className="text-lg font-bold text-slate-900">
                      {Number(request.estimated_price_ttc).toFixed(2)} €
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {session_id && (
            <p className="mt-4 text-xs text-slate-400">Référence Stripe : {session_id.slice(0, 18)}…</p>
          )}
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/b2b"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" /> Solutions B2B
            </Link>
            <Link
              to="/b2b/transport-ponctuel"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
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
