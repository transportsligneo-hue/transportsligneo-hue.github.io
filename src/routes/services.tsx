import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import ServicesContent from "@/components/ServicesContent";
import Engagements from "@/components/Engagements";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/services")({
  component: ServicesPage,
  head: () => ({
    meta: [
      { title: "Nos services · Transports Ligneo" },
      { name: "description", content: "Convoyage automobile pour particuliers et professionnels : livraison, transferts inter-agences, partenariats, rapatriement." },
      { property: "og:title", content: "Nos services · Transports Ligneo" },
      { property: "og:description", content: "Des solutions de convoyage pour particuliers et professionnels." },
      { property: "og:url", content: "https://transportsligneo.fr/services" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/services" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Convoyage automobile",
          name: "Convoyage et logistique automobile Transports Ligneo",
          description:
            "Convoyage automobile pour particuliers et professionnels : livraison, transferts inter-agences, partenariats, rapatriement.",
          areaServed: { "@type": "Country", name: "France" },
          provider: {
            "@type": "LocalBusiness",
            name: "Transports Ligneo",
            url: "https://transportsligneo.fr",
            address: { "@type": "PostalAddress", addressLocality: "Tours", addressCountry: "FR" },
          },
        }),
      },
    ],
  }),
});

function ServicesPage() {
  return (
    <>
      <Navbar />
      <main>
        <ServicesContent />
        <Engagements />
      </main>
      <Footer />
    </>
  );
}
