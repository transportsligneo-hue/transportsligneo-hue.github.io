/**
 * Ancienne adresse « Mises à jour Driver » : la page vit maintenant dans
 * Réglages & outils › Maintenance et mise à jour, onglet Mise à jour Driver.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/mises-a-jour-driver")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/maintenance", search: { onglet: "driver" }, replace: true });
  },
});
