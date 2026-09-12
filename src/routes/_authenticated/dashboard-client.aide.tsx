import { createFileRoute } from "@tanstack/react-router";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";
import AideFaq from "@/components/aide/AideFaq";

export const Route = createFileRoute("/_authenticated/dashboard-client/aide")({
  component: AideClient,
});

function AideClient() {
  return (
    <div className="space-y-6">
      <ClientPageHeader
        breadcrumb="Aide & FAQ"
        eyebrow="Centre d'aide"
        title="Comment utiliser"
        highlight="votre espace"
        subtitle="Réserver, suivre votre véhicule, signer vos documents : tout est expliqué ici."
      />
      <AideFaq audience="client" />
    </div>
  );
}
