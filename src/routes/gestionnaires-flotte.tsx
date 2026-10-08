import { createFileRoute } from "@tanstack/react-router";
import ProfilMetierPage from "@/components/marketing/ProfilMetierPage";

const T = "Convoyage pour gestionnaires de flotte · Transports Ligneo";
const D = "Une vision centralisée de tous vos mouvements de véhicules : tableau de bord, coûts, historique, TCO, alertes, reporting et multi-sites.";

export const Route = createFileRoute("/gestionnaires-flotte")({
  component: () => (
    <ProfilMetierPage
      eyebrow="Gestionnaires de flotte"
      brochures={["gestionnaires", "entreprises"]}
      title="Une vision centralisée de tous vos"
      accent="mouvements de véhicules."
      subtitle="Une vision centralisée de tous vos mouvements de véhicules : tableau de bord, coûts, historique, TCO, alertes, reporting et multi-sites."
      benefits={[
        { t: "Pilotez 50, 100 ou 500 véhicules depuis un seul espace", d: "Tableau de bord de flotte centralisé." },
        { t: "Maîtrisez vos coûts", d: "Coûts par site, par véhicule et TCO." },
        { t: "Historique complet", d: "Chaque mission, chaque document, chaque état des lieux." },
        { t: "Alertes", d: "Soyez prévenu des retards et des événements importants." },
        { t: "Reporting", d: "Volumes, délais et dépenses exportables." },
        { t: "Multi-sites", d: "Chaque site gère son périmètre, vous gardez la vue d'ensemble." },
      ]}
      highlight={{ t: "Déjà partenaire ?", d: "Accédez à votre espace flotte.", to: "/login", label: "Espace Pro" }}
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
