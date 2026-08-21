import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/b2b")({
  component: () => null,
  beforeLoad: () => {
    throw redirect({ to: "/services", search: { audience: "pro" } });
  },
  head: () => ({
    meta: [
      { title: "Solutions B2B convoyage automobile · Transports Ligneo" },
      { name: "description", content: "Deux solutions B2B : transport ponctuel avec paiement en ligne, ou partenariat flotte sur-mesure pour grands comptes, concessions et loueurs." },
    ],
  }),
});
