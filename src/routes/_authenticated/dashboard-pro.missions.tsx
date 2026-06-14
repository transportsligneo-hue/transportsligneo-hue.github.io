import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard-pro/missions")({
  component: ProMissions,
});

function ProMissions() {
  return <Outlet />;
}
