import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import AProposContent from "@/components/AProposContent";
import Footer from "@/components/Footer";
import R4Hero from "@/components/marketing/R4Hero";

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
        <R4Hero
          eyebrow="NOTRE HISTOIRE"
          title={
            <>
              La <span className="r4-accent">passion</span> du convoyage,
              <br />
              au service de votre tranquillité
            </>
          }
          subtitle="Née à Tours, Transports Ligneo est portée par une conviction : chaque véhicule mérite d'être transporté avec la même exigence qu'une pièce d'exception."
        />
        <AProposContent />
      </main>
      <Footer />
    </>
  );
}
