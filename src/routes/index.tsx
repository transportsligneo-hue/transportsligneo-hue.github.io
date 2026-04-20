import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import PourquoiNousChoisir from "@/components/PourquoiNousChoisir";
import CommentCaMarche from "@/components/CommentCaMarche";
import AvisClientsDynamiques from "@/components/AvisClientsDynamiques";
import Confiance from "@/components/Confiance";
import MissionsCounter from "@/components/MissionsCounter";
import Footer from "@/components/Footer";
import MobileHomeScreen from "@/components/mobile/MobileHomeScreen";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Transports LIGNEO — Convoyage Automobile Premium" },
      { name: "description", content: "Convoyage automobile premium depuis Tours. Livraison en France et Europe. Péages et carburant inclus. Devis gratuit." },
      { property: "og:title", content: "Transports LIGNEO — Convoyage Automobile Premium" },
      { property: "og:description", content: "La tranquillité sur toute la ligne. Votre véhicule, notre priorité." },
    ],
  }),
});

function Index() {
  return (
    <>
      {/* Mobile : écran d'app dédié */}
      <MobileHomeScreen />

      {/* Desktop : layout existant intact */}
      <div className="hidden md:block">
        <Navbar />
        <Hero />
        <MissionsCounter />
        <PourquoiNousChoisir />
        <CommentCaMarche />
        <AvisClientsDynamiques />
        <Confiance />
        <Footer />
      </div>
    </>
  );
}
