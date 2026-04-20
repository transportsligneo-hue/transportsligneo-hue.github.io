import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import CommentCaMarche from "@/components/CommentCaMarche";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/comment-ca-marche")({
  component: CommentCaMarchePage,
  head: () => ({
    meta: [
      { title: "Comment ça marche — Transports Ligneo" },
      { name: "description", content: "Découvrez les étapes simples pour confier votre véhicule à Transports Ligneo : devis, prise en charge, livraison." },
      { property: "og:title", content: "Comment ça marche — Transports Ligneo" },
      { property: "og:description", content: "Le processus de convoyage Transports Ligneo en quelques étapes." },
    ],
  }),
});

function CommentCaMarchePage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <CommentCaMarche />
      </main>
      <Footer />
    </>
  );
}
