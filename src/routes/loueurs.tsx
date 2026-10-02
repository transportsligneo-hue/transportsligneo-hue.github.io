import { createFileRoute } from "@tanstack/react-router";
import ProfilMetierPage from "@/components/marketing/ProfilMetierPage";

const T = "Convoyage pour loueurs · Transports Ligneo";
const description = "Automatisez les rotations de véhicules entre agences : repositionnement, fins de contrat, pics saisonniers, et API partenaires.";

export const Route = createFileRoute("/loueurs")({
  component: () => (
    <ProfilMetierPage
      eyebrow="Loueurs"
      title="Automatisez les rotations de véhicules"
      accent="entre agences."
      subtitle="Automatisez les rotations de véhicules entre agences : repositionnement, fins de contrat, pics saisonniers, et API partenaires."
      benefits={[
        { t: "Repositionnement entre agences", d: "Rééquilibrez votre parc là où la demande se trouve." },
        { t: "Planifiez plusieurs convoyages en une seule opération", d: "Missions groupées pour vos rotations." },
        { t: "Fins de contrat & restitutions", d: "Récupération des véhicules avec état des lieux photo." },
        { t: "Pics saisonniers", d: "Des convoyeurs disponibles 7j/7 pour absorber vos volumes." },
        { t: "Suivi en temps réel", d: "Position et heure d'arrivée de chaque véhicule." },
        { t: "Documents centralisés", d: "PV, devis et factures réunis dans votre espace." },
      ]}
      highlight={{
        t: "Connectez votre système via notre API",
        d: "Créez vos missions automatiquement depuis votre logiciel de location.",
        to: "/developpeurs",
        label: "Découvrir l'API",
      }}
    />
  ),
  head: () => ({
    meta: [
      { title: T }, { name: "description", content: description },
      { property: "og:title", content: T }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
});
