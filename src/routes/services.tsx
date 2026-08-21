import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import ServicesContent from "@/components/ServicesContent";
import Engagements from "@/components/Engagements";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/services")({
  validateSearch: (search: Record<string, unknown>) => ({
    audience: search.audience === "pro" ? ("pro" as const) : ("particuliers" as const),
  }),
  component: ServicesPage,
  head: () => ({
    meta: [
      { title: "Nos services · Particuliers & Professionnels | Transports Ligneo" },
      { name: "description", content: "Convoyage automobile pour particuliers et professionnels : livraison, transferts inter-agences, partenariats, rapatriement." },
      { property: "og:title", content: "Nos services · Transports Ligneo" },
      { property: "og:description", content: "Des solutions de convoyage pour particuliers et professionnels." },
      { property: "og:url", content: "https://transportsligneo.fr/services" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/services" }],
  }),
});

function ServicesPage() {
  const { audience } = useSearch({ from: "/services" });
  const navigate = useNavigate();

  return (
    <>
      <Navbar />
      <main>
        <ServicesContent
          audience={audience}
          onAudienceChange={(a) => navigate({ to: "/services", search: { audience: a } })}
        />
        <Engagements />
      </main>
      <Footer />
    </>
  );
}
