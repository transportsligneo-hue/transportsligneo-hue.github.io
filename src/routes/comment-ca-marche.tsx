import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import CommentCaMarcheTimeline from "@/components/CommentCaMarcheTimeline";
import Footer from "@/components/Footer";
import R4Hero from "@/components/marketing/R4Hero";

export const Route = createFileRoute("/comment-ca-marche")({
  component: CommentCaMarchePage,
  head: () => ({
    meta: [
      { title: "Comment ça marche — Transports Ligneo" },
      { name: "description", content: "12 étapes 100% digitalisées + plateforme de gestion de flotte : suivi GPS, EDL, documents et facturation centralisés." },
      { property: "og:title", content: "Comment ça marche — Transports Ligneo" },
      { property: "og:description", content: "12 étapes claires et une véritable gestion de flotte : dashboard, historique, suivi temps réel et documents centralisés." },
    ],
  }),
});

function CommentCaMarchePage() {
  return (
    <>
      <Navbar />
      <main>
        <R4Hero
          eyebrow="PARCOURS CLIENT"
          title={
            <>
              De l'estimation à la livraison,
              <br />
              <span className="r4-accent">tout est piloté</span>
            </>
          }
          subtitle="12 étapes 100% digitalisées, une plateforme unique pour vos missions, vos documents et le suivi GPS temps réel."
        />
        <CommentCaMarcheTimeline />
      </main>
      <Footer />
    </>
  );
}
