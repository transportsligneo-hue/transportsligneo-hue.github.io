import { createFileRoute, Link } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Truck, Users, ArrowRight, CheckCircle2, ShieldCheck, Zap, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/b2b")({
  component: B2BPage,
  head: () => ({
    meta: [
      { title: "Solutions B2B convoyage automobile — Transports Ligneo" },
      { name: "description", content: "Deux solutions B2B : transport ponctuel avec paiement en ligne, ou partenariat flotte sur-mesure pour grands comptes, concessions et loueurs." },
      { property: "og:title", content: "Solutions B2B — Transports Ligneo" },
      { property: "og:description", content: "Transport ponctuel B2B et partenariat flotte. Devis, paiement et dispatch professionnels." },
    ],
  }),
});

function B2BPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-20 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Solutions professionnelles
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Le convoyage automobile,<br />
            <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">pensé pour les pros</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            Que vous ayez besoin d'un transport ponctuel ou d'un partenariat de flotte récurrent, nous avons une solution dédiée.
          </p>
        </div>
      </section>

      {/* Deux cartes */}
      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          {/* Carte 1 — Transport ponctuel */}
          <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Truck className="h-7 w-7" />
            </div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">Solution 1</div>
            <h2 className="text-2xl font-bold text-slate-900">Transport ponctuel B2B</h2>
            <p className="mt-3 text-slate-600">
              Pour garages, concessions et professionnels auto qui veulent commander une course rapidement avec paiement en ligne sécurisé.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {[
                "Devis instantané avec estimateur",
                "Paiement en ligne sécurisé",
                "Confirmation immédiate",
                "Suivi opérationnel temps réel",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex-1" />
            <Link to="/b2b/transport-ponctuel" className="block">
              <Button size="lg" className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                Demander un transport ponctuel
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-3 text-center text-xs text-slate-500">Estimation et paiement en moins de 3 minutes</p>
          </article>

          {/* Carte 2 — Partenariat flotte */}
          <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-7 w-7" />
            </div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">Solution 2</div>
            <h2 className="text-2xl font-bold text-slate-900">Partenariat flotte B2B</h2>
            <p className="mt-3 text-slate-600">
              Pour entreprises, loueurs, concessions et grands comptes qui souhaitent une solution récurrente avec tarifs négociés.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {[
                "Étude personnalisée gratuite",
                "Tarifs volumes négociés",
                "Account manager dédié",
                "Facturation centralisée mensuelle",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex-1" />
            <Link to="/b2b/partenariat-flotte" className="block">
              <Button size="lg" className="w-full bg-blue-600 text-white hover:bg-blue-700">
                Demander une étude flotte
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-3 text-center text-xs text-slate-500">Réponse commerciale sous 24h ouvrées</p>
          </article>
        </div>
      </section>

      {/* Bandeau valeurs */}
      <section className="bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">Pourquoi les pros nous choisissent</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Zap, title: "Réactivité", desc: "Prise en charge sous 24-48h, immédiat possible." },
              { icon: ShieldCheck, title: "Conformité", desc: "Convoyeurs assurés, papiers à jour, RC pro." },
              { icon: FileText, title: "Traçabilité", desc: "État des lieux photo, signature numérique, PDF." },
              { icon: BarChart3, title: "Reporting", desc: "Tableau de bord pro, exports, facturation claire." },
            ].map((v) => (
              <div key={v.title} className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900">{v.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
