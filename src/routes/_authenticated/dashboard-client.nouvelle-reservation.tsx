import { createFileRoute } from "@tanstack/react-router";
import TunnelReservation from "@/components/TunnelReservation";

export const Route = createFileRoute("/_authenticated/dashboard-client/nouvelle-reservation")({
  component: NouvelleReservation,
});

function NouvelleReservation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Nouvelle réservation</h1>
        <p className="text-cream/50 text-sm mt-1">Réservez votre convoyage en quelques étapes</p>
      </div>
      <div className="card-premium rounded p-6 md:p-8">
        <TunnelReservation />
      </div>
    </div>
  );
}
