import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2, ArrowLeft } from "lucide-react";
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

function RetourPage() {
  const { session_id } = useSearch({ from: "/b2b/transport-ponctuel/retour" });

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
