import { createFileRoute } from "@tanstack/react-router";
import { ClientMissionDetailView } from "@/components/mission/ClientMissionDetailView";

export const Route = createFileRoute("/_authenticated/dashboard-pro/missions/$missionId")({
  component: ProMissionDetail,
});

function ProMissionDetail() {
  const { missionId } = Route.useParams();

  return (
    <ClientMissionDetailView
      missionId={missionId}
      backTo="/dashboard-pro/missions"
      backLabel="Retour aux missions"
    />
  );
}