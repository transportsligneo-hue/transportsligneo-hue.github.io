import { createFileRoute } from "@tanstack/react-router";
import { ClientMissionDetailView } from "@/components/mission/ClientMissionDetailView";

export const Route = createFileRoute("/_authenticated/dashboard-client/missions/$missionId")({
  component: MissionDetail,
});

function MissionDetail() {
  const { missionId } = Route.useParams();

  return (
    <ClientMissionDetailView
      missionId={missionId}
      backTo="/dashboard-client/missions"
      backLabel="Retour aux missions"
    />
  );
}
