import { createFileRoute } from "@tanstack/react-router";
import QuickMissionForm from "@/components/dashboard-pro/QuickMissionForm";

export const Route = createFileRoute("/_authenticated/dashboard-pro/nouvelle-demande")({
  component: ProNouvelleDemande,
});

function ProNouvelleDemande() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Demande de mission</h1>
        <p className="text-pro-text-soft text-sm mt-0.5">
          Créez une nouvelle demande de convoyage en quelques secondes.
        </p>
      </div>
      <QuickMissionForm successRedirect="/dashboard-pro/missions" />
    </div>
  );
}
