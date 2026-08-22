import { createFileRoute } from "@tanstack/react-router";
import LoyaltyClientPanel from "@/components/loyalty/LoyaltyClientPanel";
import FleetPageHeader from "@/components/flotte/FleetPageHeader";

export const Route = createFileRoute("/_authenticated/dashboard-pro/fidelite")({
  component: FidelitePro,
});

function FidelitePro() {
  return (
    <div className="space-y-6">
      <FleetPageHeader
        space="Espace professionnel"
        breadcrumb="Compte Kilomètres"
        eyebrow="Programme de fidélité"
        title="Compte"
        highlight="Kilomètres"
        subtitle="Kilomètres cumulés de votre société, palier en cours et avoirs disponibles."
      />
      <LoyaltyClientPanel accent="violet" />
    </div>
  );
}
