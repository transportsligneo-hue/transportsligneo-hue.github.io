import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import ServicesContent from "@/components/ServicesContent";
import Engagements from "@/components/Engagements";
import Footer from "@/components/Footer";
import R4Hero from "@/components/marketing/R4Hero";

export const Route = createFileRoute("/services")({
  component: ServicesPage,
  head: () => ({
    meta: [
      { title: "Nos services — Transports Ligneo" },
      { name: "description", content: "Convoyage automobile pour particuliers et professionnels : livraison, transferts inter-agences, partenariats, rapatriement." },
      { property: "og:title", content: "Nos services — Transports Ligneo" },
      { property: "og:description", content: "Des solutions de convoyage pour particuliers et professionnels." },
    ],
  }),
});

function ServicesPage() {
  return (
    <>
      <Navbar />
      <main>
        <R4Hero
          eyebrow="NOS EXPERTISES"
          title={
            <>
              Un service pensé pour <span className="r4-accent">chaque besoin</span>
            </>
          }
          subtitle="Que vous soyez particulier, professionnel ou gestionnaire de flotte, nos convoyeurs prennent en charge votre véhicule avec la même rigueur."
        />
        <ServicesContent />
        <Engagements />
      </main>
      <Footer />
    </>
  );
}
