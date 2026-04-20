import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Contact from "@/components/Contact";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact — Transports Ligneo" },
      { name: "description", content: "Contactez Transports Ligneo pour toute demande de convoyage automobile. Devis rapide et réponse personnalisée." },
      { property: "og:title", content: "Contact — Transports Ligneo" },
      { property: "og:description", content: "Une question ? Notre équipe vous répond rapidement." },
    ],
  }),
});

function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <Contact />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
