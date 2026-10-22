import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import AProposContent from "@/components/AProposContent";
import MobileAProposScreen from "@/components/mobile/MobileAProposScreen";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/a-propos")({
  component: AProposPage,
  head: () => ({
    meta: [
      { title: "À propos · Transports Ligneo" },
      { name: "description", content: "Découvrez l'histoire, la mission et les valeurs de Transports Ligneo, spécialiste du convoyage automobile depuis Tours." },
      { property: "og:title", content: "À propos · Transports Ligneo" },
      { property: "og:description", content: "Notre histoire, nos valeurs, notre fondateur et nos chiffres clés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://transportsligneo.fr/a-propos" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/a-propos" }],
  }),
});

function AProposPage() {
  return (
    <>
      <MobileAProposScreen />
      <div className="hidden md:block">
        <Navbar />
        <main>
          <AProposContent />
        </main>
        <Footer />
      </div>
    </>
  );
}
