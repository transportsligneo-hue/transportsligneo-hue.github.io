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
        <Tarifs />

        {/* === ESTIMATEUR === */}
        <section id="devis" className="py-12 lg:py-16 scroll-mt-24">
          <div className="max-w-6xl mx-auto px-5 lg:px-6">
            <div className="text-center mb-8">
              <span className="edl-chip inline-flex">
                <Sparkles size={12} />
                Estimation gratuite
              </span>
              <h2 className="font-heading text-3xl lg:text-4xl tracking-wide gold-gradient-text mt-3">
                Estimez votre trajet
              </h2>
            </div>

            {/* Estimateur desktop */}
            <div className="hidden md:block edl-card-strong p-1 lg:p-2">
              <DevisGenerator />
            </div>
            {/* Estimateur mobile */}
            <div className="md:hidden">
              <MobileDevisGenerator />
            </div>
          </div>
        </section>

        <PartnersMarquee />
      </main>
      <Footer />
    </>
  );
}
