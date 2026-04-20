import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import PourquoiNousChoisir from "@/components/PourquoiNousChoisir";
import Engagements from "@/components/Engagements";
import AvisClients from "@/components/AvisClients";
import Confiance from "@/components/Confiance";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/a-propos")({
  component: AProposPage,
  head: () => ({
    meta: [
      { title: "À propos — Transports Ligneo" },
      { name: "description", content: "Transports Ligneo, spécialiste du convoyage automobile premium depuis Tours. Nos engagements, nos clients, notre savoir-faire." },
      { property: "og:title", content: "À propos — Transports Ligneo" },
      { property: "og:description", content: "Notre histoire, nos engagements et la confiance de nos clients." },
    ],
  }),
});

function AProposPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <PourquoiNousChoisir />
        <Engagements />
        <AvisClients />
        <Confiance />
      </main>
      <Footer />
    </>
  );
}
