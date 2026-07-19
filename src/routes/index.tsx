import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import HomeDesktopV5 from "@/components/HomeDesktopV5";
import Footer from "@/components/Footer";
import MobileHomeScreen from "@/components/mobile/MobileHomeScreen";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Transports LIGNEO — Estimation convoyage automobile" },
      { name: "description", content: "Estimez votre convoyage automobile en 30 secondes. Service au départ de Tours, péages et carburant inclus. Disponible 7j/7." },
      { property: "og:title", content: "Transports LIGNEO — Estimation convoyage automobile" },
      { property: "og:description", content: "Estimation instantanée. Votre véhicule, notre priorité. La tranquillité sur toute la ligne." },
    ],
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
