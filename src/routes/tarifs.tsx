import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Tarifs from "@/components/Tarifs";
import DevisGenerator from "@/components/DevisGenerator";
import MobileDevisGenerator from "@/components/mobile/MobileDevisGenerator";
import PartnersMarquee from "@/components/PartnersMarquee";
import Footer from "@/components/Footer";
import { Sparkles } from "lucide-react";

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

function TarifsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 edl-section-bg">
        {/* === ESTIMATEUR — variante hero-card premium === */}
        <section id="devis" className="pt-6 pb-16 lg:pt-10 lg:pb-20 scroll-mt-32">
          <div className="max-w-3xl mx-auto px-5 lg:px-6">
            <div className="text-center mb-10">
              <span className="edl-chip inline-flex">
                <Sparkles size={12} />
                Estimation gratuite
              </span>
              <h1 className="font-heading text-3xl lg:text-5xl tracking-wide gold-gradient-text mt-3">
                Estimez votre trajet
              </h1>
              <p className="text-cream/65 text-sm lg:text-base mt-3 max-w-xl mx-auto">
                Prix, distance et durée en quelques secondes. Péages, carburant et assurance inclus.
              </p>
            </div>

            <div className="hidden md:block">
              <DevisGenerator variant="hero-card" />
            </div>
            <div className="md:hidden">
              <MobileDevisGenerator />
            </div>
          </div>
        </section>


        <Tarifs />

        <PartnersMarquee />
      </main>
      <Footer />
    </>
  );
}
