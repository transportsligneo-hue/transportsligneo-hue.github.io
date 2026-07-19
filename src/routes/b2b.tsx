import { createFileRoute, Link } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Truck, Users, ArrowRight, CheckCircle2, ShieldCheck, Zap, FileText, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/b2b")({
  component: B2BPage,
  head: () => ({
    meta: [
      { title: "Solutions B2B convoyage automobile · Transports Ligneo" },
      { name: "description", content: "Deux solutions B2B : transport ponctuel avec paiement en ligne, ou partenariat flotte sur-mesure pour grands comptes, concessions et loueurs." },
      { property: "og:title", content: "Solutions B2B · Transports Ligneo" },
      { property: "og:description", content: "Transport ponctuel B2B et partenariat flotte. Devis, paiement et dispatch professionnels." },
    ],
  }),
});

function B2BPage() {
  return (
    <>
      <Navbar />

      {/* === HERO navy premium === */}
      <section className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-32"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}>
        {/* halo doré discret */}
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(231,199,106,0.10), transparent 70%)" }} />
        <div aria-hidden className="cyber-aurora" />
        <div aria-hidden className="cyber-grid opacity-60" />
        <div aria-hidden className="cyber-scanline" />
        <div className="relative mx-auto max-w-5xl px-5 text-center">
          <span className="cyber-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] font-heading">
            <ShieldCheck className="h-3 w-3" />
            Solutions professionnelles
          </span>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-wide text-cream mt-6 leading-[1.1]">
            Le convoyage automobile,
            <br />
            <span className="cyber-title-accent">pensé pour les pros.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-cream/70 text-base lg:text-lg leading-relaxed">
            Transport ponctuel avec paiement en ligne ou partenariat flotte sur-mesure :
            <br className="hidden sm:block" />
            deux solutions dédiées aux concessions, loueurs et grands comptes.
          </p>
        </div>

        {/* courbe cream organique vers la section suivante */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "120px" }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M0,80 C320,20 760,5 1080,30 C1240,42 1360,70 1440,55 L1440,120 L0,120 Z"
              fill="var(--surface-cream, #faf7ef)" />
          </svg>
        </div>
      </section>

      {/* === Deux solutions · cartes cream premium === */}
      <section className="px-4 py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#b8860b] font-heading">Deux solutions</span>
            <h2 className="font-heading text-3xl lg:text-4xl text-[#0b1026] mt-2">Choisissez votre formule</h2>
          </div>

          <div className="grid gap-7 lg:grid-cols-2">
            {/* Carte 1 · Transport ponctuel */}
            <article className="card-premium-light group relative flex flex-col overflow-hidden p-9 transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a] to-transparent" />
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#b8860b]">
                <Truck className="h-6 w-6" />
              </div>
              <div className="mb-3 text-[10px] font-heading uppercase tracking-[0.28em] text-[#b8860b]">Solution 1</div>
              <h3 className="font-heading text-2xl lg:text-[26px] text-[#0b1026]">Transport ponctuel B2B</h3>
              <p className="mt-4 text-[#0b1026]/65 leading-relaxed">
                Pour garages, concessions et professionnels auto qui veulent commander une course rapidement avec paiement en ligne sécurisé.
              </p>
              <ul className="mt-7 space-y-3 text-[14px] text-[#0b1026]/80">
                {[
                  "Devis instantané avec estimateur",
                  "Paiement en ligne sécurisé",
                  "Confirmation immédiate",
                  "Suivi opérationnel temps réel",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#b8860b]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex-1" />
              <Link
                to="/b2b/transport-ponctuel"
                className="inline-flex items-center justify-center gap-2.5 w-full px-6 py-4 rounded-xl bg-gradient-to-r from-[#e7c76a] via-[#d4af37] to-[#e7c76a] bg-[length:200%_100%] hover:bg-[position:100%_0] text-[#0b1026] font-heading text-[11.5px] tracking-[0.24em] uppercase shadow-[0_15px_40px_-12px_rgba(231,199,106,0.55)] transition-all duration-300"
              >
                Demander un transport
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-4 text-center text-[11px] text-[#0b1026]/50 tracking-wide">Estimation et paiement en moins de 3 minutes</p>
            </article>

            {/* Carte 2 · Partenariat flotte */}
            <article className="card-premium-light group relative flex flex-col overflow-hidden p-9 transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a] to-transparent" />
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#b8860b]">
                <Users className="h-6 w-6" />
              </div>
              <div className="mb-3 text-[10px] font-heading uppercase tracking-[0.28em] text-[#b8860b]">Solution 2</div>
              <h3 className="font-heading text-2xl lg:text-[26px] text-[#0b1026]">Partenariat flotte B2B</h3>
              <p className="mt-4 text-[#0b1026]/65 leading-relaxed">
                Pour entreprises, loueurs, concessions et grands comptes qui souhaitent une solution récurrente avec tarifs négociés.
              </p>
              <ul className="mt-7 space-y-3 text-[14px] text-[#0b1026]/80">
                {[
                  "Étude personnalisée gratuite",
                  "Tarifs volumes négociés",
                  "Account manager dédié",
                  "Facturation centralisée mensuelle",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#b8860b]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex-1" />
              <Link
                to="/b2b/partenariat-flotte"
                className="inline-flex items-center justify-center gap-2.5 w-full px-6 py-4 rounded-xl border border-[#0b1026] text-[#0b1026] font-heading text-[11.5px] tracking-[0.24em] uppercase hover:bg-[#0b1026] hover:text-[#e7c76a] transition-all duration-300"
              >
                Demander une étude flotte
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-4 text-center text-[11px] text-[#0b1026]/50 tracking-wide">Réponse commerciale sous 24h ouvrées</p>
            </article>
          </div>
        </div>
      </section>

      {/* === Bandeau valeurs · navy premium === */}
      <section className="relative px-4 py-20 lg:py-24"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}>
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">Engagement Ligneo</span>
            <h2 className="font-heading text-3xl lg:text-4xl text-cream mt-2">Pourquoi les pros nous choisissent</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Zap, title: "Réactivité", desc: "Prise en charge sous 24-48h, immédiat possible." },
              { icon: ShieldCheck, title: "Conformité", desc: "Convoyeurs assurés, papiers à jour, RC pro." },
              { icon: FileText, title: "Traçabilité", desc: "État des lieux photo, signature numérique, PDF." },
              { icon: BarChart3, title: "Reporting", desc: "Tableau de bord pro, exports, facturation claire." },
            ].map((v) => (
              <div key={v.title}
                className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-7 transition-all duration-500 hover:border-[#e7c76a]/40 hover:bg-white/[0.05]">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#e7c76a]">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-[17px] text-cream tracking-wide">{v.title}</h3>
                <p className="mt-2 text-[13.5px] text-cream/60 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
