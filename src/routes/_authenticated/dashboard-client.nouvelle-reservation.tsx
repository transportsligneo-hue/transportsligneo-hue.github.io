import { createFileRoute } from "@tanstack/react-router";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";
import QuickMissionForm from "@/components/dashboard-pro/QuickMissionForm";

export const Route = createFileRoute("/_authenticated/dashboard-client/nouvelle-reservation")({
  head: () => ({ meta: [
    { title: "Demande de convoyage particulier | Transports Ligneo" },
    { name: "description", content: "Préparez votre demande de convoyage : adresses, véhicule, documents et planning." },
    { property: "og:title", content: "Demande de convoyage particulier | Transports Ligneo" },
    { property: "og:description", content: "Préparez votre demande de convoyage : adresses, véhicule, documents et planning." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
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
