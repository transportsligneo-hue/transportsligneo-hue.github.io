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

        {/* === ESTIMATEUR HOMEPAGE — verre fumé intégré au hero (Blacklane style) === */}
        <section
          id="devis"
          className="relative -mt-24 lg:-mt-32 mb-0 z-20 scroll-mt-32 pb-24 lg:pb-32"
        >
          {/* Halos lumineux discrets, ancre l'estimateur dans la nuit du hero */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-[0.16] blur-3xl"
              style={{ background: "radial-gradient(closest-side, #5fb6ff, transparent 70%)" }} />
            <div className="absolute top-1/3 right-10 w-[420px] h-[300px] rounded-full opacity-[0.12] blur-3xl"
              style={{ background: "radial-gradient(closest-side, #e7c76a, transparent 70%)" }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-6">
            {/* Carte verre fumé — englobe titre + DevisGenerator */}
            <div className="relative glass-onyx max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 pt-10 lg:pt-12 pb-8 lg:pb-10">
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/40 bg-white/[0.03] backdrop-blur-md text-[9px] tracking-[0.35em] uppercase text-primary/90">
                  <Sparkles size={11} />
                  Réservation premium
                </span>
                <h2 className="font-heading text-cream text-3xl lg:text-4xl xl:text-5xl tracking-[0.02em] mt-5 leading-[1.08]">
                  Votre prix en <span className="gold-gradient-text">30 secondes</span>.
                </h2>
                <p className="text-cream/65 text-sm lg:text-base mt-4 max-w-xl mx-auto leading-relaxed">
                  Trajet, véhicule, options — votre tarif instantané. Péage, carburant et assurance inclus.
                </p>
                <div className="gold-divider-short mt-6" />
              </div>

              {/* DevisGenerator intouché */}
              <DevisGenerator />
            </div>

            {/* Bandeau confiance — sobre, sur fond navy */}
            <div className="mt-8 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Zap, label: "Réponse immédiate" },
                { icon: Euro, label: "Tarif transparent" },
                { icon: ShieldCheck, label: "Assurance incluse" },
                { icon: Globe2, label: "France & Europe" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-white/[0.025] backdrop-blur-md">
                  <Icon size={15} className="text-primary shrink-0" />
                  <p className="font-heading text-cream/85 text-[12px] tracking-[0.08em]">{label}</p>
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
