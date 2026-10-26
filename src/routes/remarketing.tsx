import { createFileRoute } from "@tanstack/react-router";
import RemarketingPage from "@/components/marketing/remarketing/RemarketingPage";

const T = "Ligneo Remarketing · Réparer, préparer et livrer vos véhicules · Transports Ligneo";
const D = "Fin de leasing, nouveau collaborateur, remise en vente : Ligneo récupère le véhicule, le fait réparer par ses prestataires après votre accord sur le devis, le gare en parc partenaire et le livre.";

export const Route = createFileRoute("/remarketing")({
  component: RemarketingPage,
  head: () => ({
    meta: [
      { title: T }, { name: "description", content: D },
      { property: "og:title", content: T }, { property: "og:description", content: D },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
});
