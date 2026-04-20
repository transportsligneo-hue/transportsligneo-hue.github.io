import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import ServicesContent from "@/components/ServicesContent";
import Engagements from "@/components/Engagements";
import Footer from "@/components/Footer";

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
      <main className="pt-24">
        <ServicesContent />
        <Engagements />
      </main>
      <Footer />
    </>
  );
}
