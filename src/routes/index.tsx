import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import HeroDesktop from "@/components/HeroDesktop";
import PourquoiNousChoisir from "@/components/PourquoiNousChoisir";
import CommentCaMarche from "@/components/CommentCaMarche";
import AvisClientsDynamiques from "@/components/AvisClientsDynamiques";
import PartnersMarquee from "@/components/PartnersMarquee";
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

        {/* === ESTIMATEUR — barre flottante intégrée, chevauche le bas du hero === */}
        <section id="devis" className="relative -mt-20 mb-16 z-20 scroll-mt-24">
          <div className="max-w-6xl mx-auto px-6">
            <DevisGenerator />
          </div>
        </section>

        <PartnersMarquee />
        <PourquoiNousChoisir />
        <CommentCaMarche />
        <AvisClientsDynamiques />
        <Footer />
      </div>
    </>
  );
}
