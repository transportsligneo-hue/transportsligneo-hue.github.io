import { createFileRoute, Link } from "@tanstack/react-router";
import TunnelReservation from "@/components/TunnelReservation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/reserver")({
  component: ReserverPage,
  head: () => ({
    meta: [
      { title: "Réserver un convoyage — Transports Ligneo" },
      { name: "description", content: "Réservez votre convoyage automobile premium en 5 étapes : trajet, options, véhicule, coordonnées, confirmation. Prix transparent, péages inclus." },
      { property: "og:title", content: "Réserver un convoyage — Transports Ligneo" },
      { property: "og:description", content: "Tunnel de réservation en ligne pour votre convoyage premium." },
    ],
  }),
});

function ReserverPage() {
  return (
    <div className="min-h-screen bg-navy section-bg">
      <Navbar />
      <main className="pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <Link
              to="/"
              className="inline-block text-xs uppercase tracking-[0.3em] text-cream/50 hover:text-primary mb-4 transition-colors"
            >
              ← Retour à l'accueil
            </Link>
            <p className="text-xs uppercase tracking-[0.3em] text-primary/80 mb-2">Réservation</p>
            <h1 className="font-heading text-4xl sm:text-5xl gold-gradient-text mb-3">
              Votre convoyage premium
            </h1>
            <div className="gold-divider-short mb-4" />
            <p className="text-cream/70 max-w-xl mx-auto">
              Cinq étapes simples pour réserver votre convoyage. Tarif transparent, péages et carburant inclus.
            </p>
          </div>

          <div className="card-premium rounded-lg p-6 sm:p-10">
            <TunnelReservation />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
