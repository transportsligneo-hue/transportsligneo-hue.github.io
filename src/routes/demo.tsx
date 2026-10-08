import { createFileRoute, Link } from "@tanstack/react-router";
import { DemoRequestForm } from "@/components/marketing/DemoRequestButton";
import { CalendarDays, Euro, Lock, ShieldCheck, Truck } from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demander une démo de l'espace pro — Transports Ligneo" },
      {
        name: "description",
        content:
          "Concessions, loueurs, gestionnaires de flotte : recevez un accès privé à la démonstration de l'espace professionnel Ligneo. Sans engagement, valable 7 jours.",
      },
      { property: "og:title", content: "Découvrez l'espace professionnel Transports Ligneo" },
      {
        property: "og:description",
        content:
          "Pilotez vos convoyages, votre facturation et vos équipes depuis un seul espace. Demandez votre démo privée, sans engagement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoLanding,
});

const POINTS = [
  { icon: Truck, text: "Tableau de bord, indicateurs et missions en direct" },
  { icon: CalendarDays, text: "Suivi GPS et comparaison des photos départ / arrivée" },
  { icon: Euro, text: "Calendrier, rapports et export pour la comptabilité" },
  { icon: ShieldCheck, text: "Gestion d'équipe : administrateur, logistique, comptabilité" },
];

function DemoLanding() {
  return (
    <main className="demo-landing">
      <header className="demo-landing-head">
        <p className="demo-pro-eyebrow">Espace professionnel</p>
        <h1>Demandez votre <span>démo privée</span></h1>
        <p className="demo-landing-sub">
          Concessions, loueurs, gestionnaires de flotte : laissez vos coordonnées, un conseiller
          Ligneo vous envoie un lien personnel vers la démonstration, valable 7 jours.
        </p>
      </header>

      <div className="demo-landing-grid">
        <div className="demo-req-modal demo-req-inline">
          <DemoRequestForm />
        </div>

        <aside className="demo-landing-aside">
          <h2>Ce que vous allez découvrir</h2>
          <ul>
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon size={16} aria-hidden /> {text}
              </li>
            ))}
          </ul>
          <p className="demo-landing-note">
            <Lock size={13} aria-hidden /> Sans engagement · Lien valable 7 jours · Sans mot de passe
          </p>
          <p className="demo-landing-link">
            Vous avez déjà reçu votre lien ?{" "}
            <Link to="/demo-pro">Ouvrir la démonstration</Link>
          </p>
        </aside>
      </div>
    </main>
  );
}
