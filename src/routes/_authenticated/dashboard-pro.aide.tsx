import { createFileRoute } from "@tanstack/react-router";
import FleetPageHeader from "@/components/flotte/FleetPageHeader";
import AideFaq from "@/components/aide/AideFaq";

export const Route = createFileRoute("/_authenticated/dashboard-pro/aide")({
  component: AidePro,
});

function AidePro() {
  return (
    <div className="space-y-6">
      <FleetPageHeader
        space="Espace professionnel"
        breadcrumb="Aide & FAQ"
        eyebrow="Centre d'aide"
        title="Comment utiliser"
        highlight="votre espace"
        subtitle="Tous vos outils expliqués simplement : missions, parc, conducteurs, suivi, facturation."
      />
      <AideFaq audience="pro" />
    </div>
  );
}
