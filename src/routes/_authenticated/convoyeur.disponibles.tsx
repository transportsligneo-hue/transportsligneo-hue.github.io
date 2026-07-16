import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Ancienne page "Catalogue missions" — supprimée.
 * Toute visite est redirigée vers le nouveau catalogue.
 */
export const Route = createFileRoute("/_authenticated/convoyeur/disponibles")({
  beforeLoad: () => {
    throw redirect({ to: "/convoyeur/catalogue" });
  },
});
