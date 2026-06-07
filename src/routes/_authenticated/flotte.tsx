import { createFileRoute, redirect } from "@tanstack/react-router";

// Espace flotte fusionné dans /dashboard-pro — toutes les routes /flotte/* redirigent.
export const Route = createFileRoute("/_authenticated/flotte")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard-pro" });
  },
  component: () => null,
});
