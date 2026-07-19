import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Contact from "@/components/Contact";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import R4Hero from "@/components/marketing/R4Hero";

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
      <main>
        <R4Hero
          eyebrow="ON EN PARLE ?"
          title={
            <>
              Un projet, une question ?
              <br />
              <span className="r4-accent">Écrivons-le ensemble</span>
            </>
          }
          subtitle="Notre équipe basée à Tours vous répond sous quelques heures, 7 jours sur 7."
        />
        <Contact />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
