import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import CommentCaMarcheTimeline from "@/components/CommentCaMarcheTimeline";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/comment-ca-marche")({
  component: CommentCaMarchePage,
  head: () => ({
    meta: [
      { title: "Comment ça marche · Transports Ligneo" },
      { name: "description", content: "12 étapes 100% digitalisées + plateforme de gestion de flotte : suivi GPS, EDL, documents et facturation centralisés." },
      { property: "og:title", content: "Comment ça marche · Transports Ligneo" },
      { property: "og:description", content: "12 étapes claires et une véritable gestion de flotte : dashboard, historique, suivi temps réel et documents centralisés." },
    ],
  }),
});

function CommentCaMarchePage() {
  return (
    <>
      <Navbar />
      <main>
        <CommentCaMarcheTimeline />
      </main>
      <Footer />
    </>
  );
}
