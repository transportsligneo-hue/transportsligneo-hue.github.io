import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import HeroDesktop from "@/components/HeroDesktop";
import PourquoiNousChoisir from "@/components/PourquoiNousChoisir";
import CommentCaMarche from "@/components/CommentCaMarche";
import PartnersMarquee from "@/components/PartnersMarquee";
import { Sparkles, ShieldCheck, Zap, Euro, Globe2 } from "lucide-react";
import Footer from "@/components/Footer";
import DevisGenerator from "@/components/DevisGenerator";
import MobileHomeScreen from "@/components/mobile/MobileHomeScreen";


export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Transports LIGNEO — Estimation convoyage automobile premium" },
      { name: "description", content: "Estimez votre convoyage automobile en 30 secondes. Service premium au départ de Tours, péages et carburant inclus. Disponible 7j/7." },
      { property: "og:title", content: "Transports LIGNEO — Estimation convoyage automobile premium" },
      { property: "og:description", content: "Estimation instantanée. Votre véhicule, notre priorité. La tranquillité sur toute la ligne." },
    ],
  }),
});

function Index() {
  return (
    <>
      {/* Mobile : écran d'app dédié */}
      <MobileHomeScreen />

      {/* Desktop : layout premium style Inspection Driver */}
      <div className="hidden md:block">
        <Navbar />
        <HeroDesktop />

        {/* === ESTIMATEUR HOMEPAGE — fond clair, carte blanche premium === */}
        <section
          id="devis"
          className="relative mt-12 lg:mt-16 mb-0 z-20 scroll-mt-32 section-cream py-20 lg:py-28"
        >
          {/* Halo doré très discret */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 right-10 w-[420px] h-[280px] rounded-full opacity-[0.10] blur-3xl"
              style={{ background: "radial-gradient(closest-side, #e7c76a, transparent 70%)" }} />
            <div className="absolute -bottom-24 left-1/4 w-[600px] h-[300px] rounded-full opacity-[0.08] blur-3xl"
              style={{ background: "radial-gradient(closest-side, #5fb6ff, transparent 70%)" }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-6">
            {/* En-tête éditorial sur fond clair */}
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/40 bg-white text-[10px] tracking-[0.3em] uppercase text-ink-soft shadow-sm">
                <Sparkles size={12} className="text-primary" />
                Estimation instantanée
              </span>
              <h2 className="font-heading text-ink text-4xl lg:text-5xl xl:text-6xl tracking-[0.02em] mt-5 leading-[1.05]">
                Votre prix en <span className="gold-gradient-text">30 secondes</span>.
              </h2>
              <p className="text-ink-muted text-base lg:text-lg mt-4 max-w-2xl mx-auto leading-relaxed">
                Renseignez votre trajet, votre véhicule et obtenez immédiatement
                un tarif transparent.
                <br />
                Péage, carburant et assurance inclus.
              </p>
            </div>

            {/* Wrapper carte blanche — encapsule DevisGenerator sans le modifier */}
            <div className="relative card-light hairline-gold-top p-2 sm:p-3 md:p-4 max-w-5xl mx-auto">
              <DevisGenerator />
            </div>

            {/* Bandeau de confiance — pastilles claires */}
            <div className="mt-10 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Zap, label: "Réponse immédiate", sub: "Tarif live" },
                { icon: Euro, label: "Tarif transparent", sub: "Sans surprise" },
                { icon: ShieldCheck, label: "Assurance incluse", sub: "Mission couverte" },
                { icon: Globe2, label: "Service Europe", sub: "France & UE" },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[rgba(11,16,38,0.08)] shadow-sm">
                  <span className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-primary" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-heading text-ink text-[13px] tracking-wide leading-tight">{label}</p>
                    <p className="text-ink-muted text-[11px] mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PartnersMarquee />
        <PourquoiNousChoisir />
        <CommentCaMarche />
        <Footer />
      </div>
    </>
  );
}
