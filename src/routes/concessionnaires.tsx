import { createFileRoute } from "@tanstack/react-router";
import ProfilMetierPage from "@/components/marketing/ProfilMetierPage";

const T = "Convoyage pour concessionnaires · Transports Ligneo";
const D = "Transferts inter-sites, livraisons clients, véhicules d'essai et restitutions : déplacez vos véhicules entre concessions, ateliers et clients.";

export const Route = createFileRoute("/concessionnaires")({
  component: () => (
    <ProfilMetierPage
      eyebrow="Concessionnaires"
      brochures={["concessions"]}
      title="Déplacez vos véhicules entre concessions, ateliers"
      accent="et clients."
      subtitle={"Transferts inter-sites, livraisons clients, véhicules d'essai et restitutions : déplacez vos véhicules entre concessions, ateliers et clients."}
      benefits={[
        { t: "Transferts inter-sites", d: "Vos véhicules passent d'une concession à l'autre sans mobiliser vos équipes." },
        { t: "Livraisons clients", d: "Remise en main propre, clés et documents, avec signature électronique." },
        { t: "Véhicules d'essai", d: "Acheminement et retour de vos véhicules de démonstration." },
        { t: "Restitutions", d: "Livraison + restitution liées dans une seule mission." },
        { t: "Suivi des mouvements", d: "Chaque déplacement tracé : GPS, états des lieux, historique." },
        { t: "Une seule facture pour l'ensemble de vos sites", d: "Facturation consolidée par site ou par mission." },
      ]}
    />
  ),
  head: () => ({
    meta: [
      { title: T }, { name: "description", content: D },
      { property: "og:title", content: T }, { property: "og:description", content: D },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
});
