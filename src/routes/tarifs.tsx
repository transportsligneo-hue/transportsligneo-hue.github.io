import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Tarifs from "@/components/Tarifs";
import DevisGenerator from "@/components/DevisGenerator";
import MobileDevisGenerator from "@/components/mobile/MobileDevisGenerator";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/tarifs")({
  component: TarifsPage,
  head: () => ({
    meta: [
      { title: "Tarifs & devis — Transports Ligneo" },
      { name: "description", content: "Tarifs convoyage automobile au départ de Tours et du département 37. Estimez votre trajet en quelques clics." },
      { property: "og:title", content: "Tarifs & devis — Transports Ligneo" },
      { property: "og:description", content: "Tarifs transparents et estimateur de trajet en ligne." },
    ],
  }),
});

function TarifsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <Tarifs />
        {/* Estimateur desktop — inchangé */}
        <div className="hidden md:block">
          <DevisGenerator />
        </div>
        {/* Estimateur mobile — refonte premium */}
        <MobileDevisGenerator />
      </main>
      <Footer />
    </>
  );
}
