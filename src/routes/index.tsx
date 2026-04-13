import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Engagements from "@/components/Engagements";
import Prestations from "@/components/Prestations";
import Tarifs from "@/components/Tarifs";
import Confiance from "@/components/Confiance";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Transports LIGNEO — Convoyage Automobile Premium" },
      { name: "description", content: "Service de convoyage automobile haut de gamme basé à Tours. Livraison de véhicules en France et en Europe avec rigueur et discrétion." },
      { property: "og:title", content: "Transports LIGNEO — Convoyage Automobile Premium" },
      { property: "og:description", content: "La tranquillité sur toute la ligne. Votre véhicule, notre priorité." },
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
      <Confiance />
      <Contact />
      <Footer />
    </>
  );
}
