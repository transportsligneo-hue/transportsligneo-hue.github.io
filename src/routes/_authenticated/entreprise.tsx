import { createFileRoute, redirect } from "@tanstack/react-router";

// Espace entreprise fusionné dans /dashboard-pro — toutes les routes /entreprise/* redirigent.
export const Route = createFileRoute("/_authenticated/entreprise")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard-pro" });
  },
  component: () => null,
});
