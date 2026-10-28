import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ancienne page : les demandes rapides sont maintenant un onglet de « Demandes ». */
export const Route = createFileRoute("/_authenticated/admin/demandes-rapides")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/demandes", search: { vue: "rapides" } as never });
  },
});
