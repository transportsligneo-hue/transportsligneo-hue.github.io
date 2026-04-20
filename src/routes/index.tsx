import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import PourquoiNousChoisir from "@/components/PourquoiNousChoisir";
import CommentCaMarche from "@/components/CommentCaMarche";
import AvisClients from "@/components/AvisClients";
import Confiance from "@/components/Confiance";
import Footer from "@/components/Footer";

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
      <Navbar />
      <Hero />
      <PourquoiNousChoisir />
      <CommentCaMarche />
      <AvisClients />
      <Confiance />
      <Footer />
    </>
  );
}
