import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import CommentCaMarcheTimeline from "@/components/CommentCaMarcheTimeline";
import Footer from "@/components/Footer";
import CommentCaMarche5Etapes from "@/components/CommentCaMarche5Etapes";

export const Route = createFileRoute("/comment-ca-marche")({
  component: CommentCaMarchePage,
  head: () => ({
    meta: [
      { title: "Comment ça marche · Transports Ligneo" },
      { name: "description", content: "12 étapes 100% digitalisées + plateforme de gestion de flotte : suivi GPS, EDL, documents et facturation centralisés." },
      { property: "og:title", content: "Comment ça marche · Transports Ligneo" },
      { property: "og:description", content: "12 étapes claires et une véritable gestion de flotte : dashboard, historique, suivi temps réel et documents centralisés." },
      { property: "og:url", content: "https://transportsligneo.fr/comment-ca-marche" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/comment-ca-marche" }],
  }),
});

function CommentCaMarchePage() {
  return (
    <>
      <Navbar />
      <main>
        <CommentCaMarche5Etapes />
        <CommentCaMarcheTimeline />
      </main>
      <Footer />
    </>
  );
}
