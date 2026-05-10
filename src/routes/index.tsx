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

        {/* === ESTIMATEUR HOMEPAGE — version hero premium SaaS === */}
        <section
          id="devis"
          className="relative mt-12 lg:mt-16 mb-24 z-20 scroll-mt-32"
        >
          {/* Halos lumineux discrets en arrière-plan */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-[0.18] blur-3xl"
              style={{ background: "radial-gradient(closest-side, #5fb6ff, transparent 70%)" }} />
            <div className="absolute -top-10 right-10 w-[400px] h-[300px] rounded-full opacity-[0.10] blur-3xl"
              style={{ background: "radial-gradient(closest-side, #e7c76a, transparent 70%)" }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-6">
            {/* En-tête éditorial */}
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#5fb6ff]/30 bg-white/[0.04] backdrop-blur-md text-[10px] tracking-[0.3em] uppercase text-[#9bcaff]">
                <Sparkles size={12} className="text-[#e7c76a]" />
                Estimation instantanée
              </span>
              <h2 className="font-heading text-cream text-4xl lg:text-5xl xl:text-6xl tracking-[0.02em] mt-5 leading-[1.05]">
                Votre prix en <span className="gold-gradient-text">30 secondes</span>.
              </h2>
              <p className="text-cream/70 text-base lg:text-lg mt-4 max-w-2xl mx-auto leading-relaxed">
                Renseignez votre trajet, votre véhicule et obtenez immédiatement
                un tarif transparent — péages, carburant et assurance inclus.
              </p>
            </div>

            <DevisGenerator />

            {/* Bandeau de confiance */}
            <div className="mt-8 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Zap, label: "Réponse immédiate", sub: "Tarif live" },
                { icon: Euro, label: "Tarif transparent", sub: "Sans surprise" },
                { icon: ShieldCheck, label: "Assurance incluse", sub: "Mission couverte" },
                { icon: Globe2, label: "Service Europe", sub: "France & UE" },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-white/[0.03] backdrop-blur-md">
                  <span className="w-9 h-9 rounded-lg bg-[#5fb6ff]/12 border border-[#5fb6ff]/25 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-[#9bcaff]" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-heading text-cream text-[13px] tracking-wide leading-tight">{label}</p>
                    <p className="text-cream/50 text-[11px] mt-0.5">{sub}</p>
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
