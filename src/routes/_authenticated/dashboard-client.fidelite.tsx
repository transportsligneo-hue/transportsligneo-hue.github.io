import { createFileRoute } from "@tanstack/react-router";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";
import LoyaltyClientPanel from "@/components/loyalty/LoyaltyClientPanel";

export const Route = createFileRoute("/_authenticated/dashboard-client/fidelite")({
  component: FideliteClient,
});

function FideliteClient() {
  return (
    <div className="space-y-6">
      <ClientPageHeader
        breadcrumb="Compte Kilomètres"
        eyebrow="Programme de fidélité"
        title="Compte"
        highlight="Kilomètres"
        subtitle="Vos kilomètres cumulés, votre palier et vos avoirs disponibles."
      />
      <LoyaltyClientPanel accent="blue" />
    </div>
  );
}
