import { createFileRoute } from "@tanstack/react-router";
import { ClientMissionDetailView } from "@/components/mission/ClientMissionDetailView";

export const Route = createFileRoute("/_authenticated/flotte/missions/$missionId")({
  component: FlotteMissionDetail,
});

function FlotteMissionDetail() {
  const { missionId } = Route.useParams();
  return (
    <ClientMissionDetailView
      missionId={missionId}
      backTo="/flotte/missions"
      backLabel="Retour aux missions"
    />
  );
}
