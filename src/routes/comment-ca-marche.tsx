import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import CommentCaMarcheTimeline from "@/components/CommentCaMarcheTimeline";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/comment-ca-marche")({
  component: CommentCaMarchePage,
  head: () => ({
    meta: [
      { title: "Comment ça marche — Transports Ligneo" },
      { name: "description", content: "Réservation, prise en charge, livraison : découvrez les 3 étapes simples du convoyage Transports Ligneo." },
      { property: "og:title", content: "Comment ça marche — Transports Ligneo" },
      { property: "og:description", content: "Le processus de convoyage Transports Ligneo en 3 étapes claires." },
    ],
  }),
});

function CommentCaMarchePage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <CommentCaMarcheTimeline />
      </main>
      <Footer />
    </>
  );
}
