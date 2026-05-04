import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import HeroDesktop from "@/components/HeroDesktop";
import PourquoiNousChoisir from "@/components/PourquoiNousChoisir";
import CommentCaMarche from "@/components/CommentCaMarche";
import AvisClientsDynamiques from "@/components/AvisClientsDynamiques";
import PartnersMarquee from "@/components/PartnersMarquee";
import MissionsCounter from "@/components/MissionsCounter";
import Footer from "@/components/Footer";
import DevisGenerator from "@/components/DevisGenerator";
import MobileHomeScreen from "@/components/mobile/MobileHomeScreen";
import { Sparkles } from "lucide-react";

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

        {/* === ESTIMATEUR — bloc principal pleine largeur, juste après le hero === */}
        <section id="devis" className="relative edl-section-bg py-16 lg:py-20 scroll-mt-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-8 lg:mb-10">
              <span className="edl-chip mb-4 inline-flex">
                <Sparkles size={12} />
                Outil d'estimation
              </span>
              <h2 className="font-heading text-3xl lg:text-5xl tracking-wide gold-gradient-text mt-3">
                Estimez votre trajet en 30 secondes
              </h2>
              <p className="text-cream/75 mt-4 max-w-2xl mx-auto text-base lg:text-lg">
                Renseignez votre départ, votre arrivée et votre véhicule.
                Vous recevez immédiatement un devis transparent — péages et carburant inclus.
              </p>
              <div className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-[#5fb6ff] to-transparent" />
            </div>

            <div className="edl-card-strong p-1 lg:p-2">
              <DevisGenerator />
            </div>
          </div>
        </section>

        <PartnersMarquee />
        <MissionsCounter />
        <PourquoiNousChoisir />
        <CommentCaMarche />
        <AvisClientsDynamiques />
        <Footer />
      </div>
    </>
  );
}
