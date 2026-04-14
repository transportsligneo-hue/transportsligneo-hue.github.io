import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Engagements from "@/components/Engagements";
import Prestations from "@/components/Prestations";
import Tarifs from "@/components/Tarifs";
import DevisGenerator from "@/components/DevisGenerator";
import Confiance from "@/components/Confiance";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Transports LIGNEO — Convoyage Automobile Premium" },
      { name: "description", content: "Convoyage automobile premium depuis Tours. Livraison en France et Europe." },
      { property: "og:title", content: "Transports LIGNEO — Convoyage Automobile Premium" },
      { property: "og:description", content: "La tranquillite sur toute la ligne. Votre vehicule, notre priorite." },
    ],
  }),
});

function Index() {
  return (
    <>
      <Navbar />
      <Hero />
      <Engagements />
      <Prestations />
      <Tarifs />
      <DevisGenerator />
      <Confiance />
      <Contact />
      <Footer />
    </>
  );
}
