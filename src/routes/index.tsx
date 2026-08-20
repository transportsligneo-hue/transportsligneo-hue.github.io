import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import HomeDesktopV5 from "@/components/HomeDesktopV5";
import Footer from "@/components/Footer";
import MobileHomeScreen from "@/components/mobile/MobileHomeScreen";
import ogHome from "@/assets/og-accueil-ligneo.jpg.asset.json";

const OG_IMAGE = `https://transportsligneo.fr${ogHome.url}`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Transports Ligneo — Convoyage et logistique automobile B2B | Particuliers & Professionnels" },
      { name: "description", content: "Transports Ligneo, spécialiste du convoyage et logistique automobile B2B et particuliers. Concessionnaires, loueurs, gestionnaires de flotte : missions à la carte, état des lieux digital, suivi GPS temps réel et API partenaires. Basés à Tours, disponibles 7j/7 en France et en Europe." },
      { property: "og:title", content: "Transports Ligneo — Convoyage et logistique automobile B2B | Particuliers & Professionnels" },
      { property: "og:description", content: "Transports Ligneo, spécialiste du convoyage et logistique automobile B2B et particuliers. Concessionnaires, loueurs, gestionnaires de flotte : missions à la carte, état des lieux digital, suivi GPS temps réel et API partenaires. Basés à Tours, disponibles 7j/7 en France et en Europe." },
      { property: "og:url", content: "https://transportsligneo.fr/" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/" }],
  }),
});

function Index() {
  return (
    <>
      {/* Mobile : écran d'app dédié */}
      <MobileHomeScreen />

      {/* Desktop : refonte V5 exacte comme le HTML */}
      <div className="hidden md:block">
        <Navbar />
        <main id="main-content">
          <HomeDesktopV5 />
        </main>
        <Footer />
      </div>
    </>
  );
}
