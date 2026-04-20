import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Prestations from "@/components/Prestations";
import Engagements from "@/components/Engagements";
import PourquoiNousChoisir from "@/components/PourquoiNousChoisir";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/services")({
  component: ServicesPage,
  head: () => ({
    meta: [
      { title: "Nos services — Transports Ligneo" },
      { name: "description", content: "Convoyage automobile premium : livraisons particuliers et professionnels, mises à disposition, prestations sur-mesure depuis Tours." },
      { property: "og:title", content: "Nos services — Transports Ligneo" },
      { property: "og:description", content: "Convoyage automobile premium pour particuliers et professionnels." },
    ],
  }),
});

function ServicesPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <Prestations />
        <Engagements />
        <PourquoiNousChoisir />
      </main>
      <Footer />
    </>
  );
}
