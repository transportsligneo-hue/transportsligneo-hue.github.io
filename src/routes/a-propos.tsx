import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import AProposContent from "@/components/AProposContent";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/a-propos")({
  component: AProposPage,
  head: () => ({
    meta: [
      { title: "À propos — Transports Ligneo" },
      { name: "description", content: "Découvrez l'histoire, la mission et les valeurs de Transports Ligneo, spécialiste du convoyage automobile depuis Tours." },
      { property: "og:title", content: "À propos — Transports Ligneo" },
      { property: "og:description", content: "Notre histoire, nos valeurs, notre fondateur et nos chiffres clés." },
    ],
  }),
});

function AProposPage() {
  return (
    <>
      <Navbar />
      <main>
        <AProposContent />
      </main>
      <Footer />
    </>
  );
}
