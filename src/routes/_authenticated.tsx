import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  component: () => <Outlet />,
});
