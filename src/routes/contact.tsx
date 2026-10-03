import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Contact from "@/components/Contact";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/contact")({
  // Préremplissage B2B : /contact?audience=pro&formule=ponctuel|flotte
  validateSearch: (search: Record<string, unknown>) => ({
    audience: search.audience === "pro" ? ("pro" as const) : (undefined as "pro" | undefined),
    formule:
      search.formule === "ponctuel" || search.formule === "flotte"
        ? (search.formule as "ponctuel" | "flotte")
        : (undefined as "ponctuel" | "flotte" | undefined),
  }),
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact · Transports Ligneo" },
      { name: "description", content: "Contactez Transports Ligneo pour toute demande de convoyage automobile. Devis rapide et réponse personnalisée." },
      { property: "og:title", content: "Contact · Transports Ligneo" },
      { property: "og:description", content: "Une question ? Notre équipe vous répond rapidement." },
      { property: "og:url", content: "https://transportsligneo.fr/contact" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/contact" }],
  }),
});

function ContactPage() {
  return (
    <>
      <Navbar />
      <main>
        <Contact />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
