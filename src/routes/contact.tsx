import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Contact from "@/components/Contact";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import { useState } from "react";

export const Route = createFileRoute("/contact")({
  // Préremplissage B2B : /contact?audience=pro&formule=ponctuel|flotte
  validateSearch: (search: Record<string, unknown>): { audience?: "pro"; formule?: "ponctuel" | "flotte" } => ({
    audience: search.audience === "pro" ? "pro" : undefined,
    formule: search.formule === "ponctuel" || search.formule === "flotte" ? search.formule : undefined,
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
  const [profil, setProfil] = useState<"particulier" | "pro">("particulier");
  return (
    <>
      <Navbar />
      <main>
         <Contact onProfilChange={setProfil} />
         <FAQ audience={profil} />
      </main>
      <Footer />
    </>
  );
}
