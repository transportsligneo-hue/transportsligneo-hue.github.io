import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Tarifs from "@/components/Tarifs";
import DevisGenerator from "@/components/DevisGenerator";
import MobileDevisGenerator from "@/components/mobile/MobileDevisGenerator";
import PartnersMarquee from "@/components/PartnersMarquee";
import Footer from "@/components/Footer";
import { Sparkles, ShieldCheck, Wallet, Clock3, Zap } from "lucide-react";

export const Route = createFileRoute("/tarifs")({
  component: TarifsPage,
  head: () => ({
    meta: [
      { title: "Tarifs & estimation — Transports Ligneo" },
      { name: "description", content: "Tarifs convoyage automobile au départ de Tours et du département 37. Obtenez une estimation immédiate." },
      { property: "og:title", content: "Tarifs & estimation — Transports Ligneo" },
      { property: "og:description", content: "Tarifs transparents et estimateur de trajet en ligne." },
    ],
  }),
});

const trustPills = [
  { icon: Zap, label: "Réponse immédiate" },
  { icon: ShieldCheck, label: "Assurance incluse" },
  { icon: Wallet, label: "Péages & carburant inclus" },
  { icon: Clock3, label: "Disponible 7j/7" },
];

function TarifsPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* === HERO NAVY PREMIUM (même rythme que l'accueil) === */}
        <section
          className="relative overflow-hidden pt-32 pb-40 lg:pt-40 lg:pb-48"
          style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}
        >
          {/* halo doré + électrique discret */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(50% 50% at 30% 0%, rgba(95,182,255,0.10), transparent 70%), radial-gradient(50% 60% at 70% 0%, rgba(231,199,106,0.10), transparent 70%)",
            }}
          />

          <div className="relative mx-auto max-w-4xl px-5 text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="h-px w-12 bg-[#e7c76a]" />
              <span className="text-[#e7c76a] text-[11px] tracking-[0.32em] uppercase font-heading">
                <Sparkles size={11} className="inline -mt-0.5 mr-1.5" />
                Estimation gratuite & immédiate
              </span>
              <span className="h-px w-12 bg-[#e7c76a]" />
            </div>

            <h1 className="font-heading text-cream text-4xl lg:text-6xl tracking-wide leading-[1.08]">
              Tarifs transparents,
              <br />
              <span className="gold-gradient-text">prix instantané.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-cream/75 text-base lg:text-lg leading-relaxed">
              Estimez votre trajet en quelques secondes. Péages, carburant et assurance tout
              risque inclus. Aucune surprise.
            </p>

            <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
              {trustPills.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[rgba(231,199,106,0.35)] bg-[rgba(231,199,106,0.08)]">
                    <Icon size={13} className="text-[#e7c76a]" strokeWidth={2.2} />
                  </span>
                  <span className="text-cream/85 text-[12.5px] tracking-[0.04em]">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* courbe cream organique vers la section suivante */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "140px" }}>
            <svg viewBox="0 0 1440 140" preserveAspectRatio="none" className="w-full h-full block">
              <path
                d="M0,90 C260,30 620,5 900,30 C1130,50 1300,90 1440,70 L1440,140 L0,140 Z"
                fill="var(--surface-cream, #faf7ef)"
              />
            </svg>
          </div>
        </section>

        {/* === ESTIMATEUR sur fond cream (carte verre fumé glass-onyx) === */}
        <section
          id="devis"
          className="pt-2 pb-20 scroll-mt-32"
          style={{ background: "var(--surface-cream, #faf7ef)" }}
        >
          <div className="max-w-3xl mx-auto px-5 lg:px-6 -mt-16 lg:-mt-24 relative z-10">
            {/* halo doré derrière la carte */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-[36px] opacity-60 blur-2xl"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(231,199,106,0.22), transparent 70%)",
              }}
            />
            <div className="relative">
              <div className="hidden md:block">
                <DevisGenerator variant="hero-card" />
              </div>
              <div className="md:hidden">
                <MobileDevisGenerator />
              </div>
            </div>
          </div>
        </section>

        {/* === Partners (intouchable) === */}
        <PartnersMarquee />

        {/* === Tarifs détaillés (navy premium, même rythme que CommentCaMarche) === */}
        <Tarifs />
      </main>
      <Footer />
    </>
  );
}
