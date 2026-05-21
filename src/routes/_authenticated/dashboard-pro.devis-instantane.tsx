import { createFileRoute, redirect } from "@tanstack/react-router";

// Ancienne route conservée pour ne pas casser les anciens liens —
// redirige maintenant vers le nouveau parcours "Demande de mission".
export const Route = createFileRoute("/_authenticated/dashboard-pro/devis-instantane")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard-pro/nouvelle-demande" });
  },
});
