import { createFileRoute } from "@tanstack/react-router";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";
import QuickMissionForm from "@/components/dashboard-pro/QuickMissionForm";

export const Route = createFileRoute("/_authenticated/dashboard-client/nouvelle-reservation")({
  component: NouvelleReservation,
});

function NouvelleReservation() {
  return (
    <div className="space-y-6">
      <ClientPageHeader
        breadcrumb="Nouvelle réservation"
        eyebrow="Demande de convoyage"
        title="Nouvelle"
        highlight="réservation"
        subtitle="Renseignez le trajet et le véhicule — l'estimation s'affiche en direct."
      />
      <QuickMissionForm variant="particulier" successRedirect="/dashboard-client/devis" />
    </div>
  );
}
