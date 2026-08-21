import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pro")({
  component: () => null,
  beforeLoad: () => {
    throw redirect({ to: "/services", search: { audience: "pro" } });
  },
  head: () => ({
    meta: [
      { title: "Solutions B2B convoyage · Concessions, loueurs, flottes | Transports Ligneo" },
      { name: "description", content: "Une plateforme dédiée aux pros pour piloter vos convoyages, votre facturation et vos équipes depuis un seul espace." },
    ],
  }),
});
