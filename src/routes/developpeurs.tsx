import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, ClipboardCheck, FileText, KeyRound, LockKeyhole, Radio, Truck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LigneoLockup from "@/components/brand/LigneoLockup";

export const Route = createFileRoute("/developpeurs")({
  component: DeveloperPage,
  head: () => ({
    meta: [
      { title: "API Développeur — Transports Ligneo" },
      { name: "description", content: "Intégrez le convoyage automobile dans votre DMS, ERP ou plateforme de gestion de flotte : devis, missions, suivi et documents." },
      { property: "og:title", content: "API Développeur — Transports Ligneo" },
      { property: "og:description", content: "Devis, missions, suivi et documents : connectez Transports Ligneo à vos outils." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const capabilities = [
  { Icon: ClipboardCheck, title: "Devis instantanés", description: "Générez une estimation de prix en temps réel à partir d'une adresse d'enlèvement et de livraison, avant de la transformer en devis formel.", tag: "quotes" },
  { Icon: Truck, title: "Missions de convoyage", description: "Créez une mission à partir d'un devis accepté, suivez son statut et sa position GPS en temps réel jusqu'à la livraison.", tag: "missions" },
  { Icon: FileText, title: "Documents centralisés", description: "Récupérez automatiquement le bon de livraison signé, l'état des lieux et la facture liés à chaque mission.", tag: "documents" },
  { Icon: Radio, title: "Notifications en temps réel", description: "Recevez un webhook signé à chaque changement de statut — mission assignée, démarrée, livrée ou annulée.", tag: "webhooks" },
];

function DeveloperPage() {
  return <>
    <Navbar />
    <main className="developer-page">
      <section className="developer-hero">
        <div className="developer-brand"><LigneoLockup size="lg" /></div>
        <div className="developer-eyebrow"><span />API REST · v1</div>
        <h1>Connectez Transports Ligneo <span>directement à vos outils</span></h1>
        <p>Devis, missions de convoyage, suivi et documents : intégrez le convoyage automobile dans votre DMS, votre ERP ou votre plateforme de gestion de flotte, sans changer vos habitudes.</p>
        <div className="developer-hero-actions">
          <Link className="developer-button developer-button-primary" to="/contact">Demander un accès API <ArrowRight size={17} /></Link>
          <a className="developer-button developer-button-outline" href="#cas-usage">Voir un cas d'usage</a>
        </div>
      </section>
      <div className="developer-trust" aria-label="Caractéristiques de l'API">
        {[["REST", "JSON · HTTPS"], ["HMAC", "WEBHOOKS SIGNÉS"], ["TEMPS RÉEL", "SUIVI DES MISSIONS"]].map(([value, label]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}
      </div>
      <section className="developer-section" id="cas-usage">
        <div className="developer-section-head"><span>Ce que vous pouvez faire</span><h2>Une API pensée pour votre quotidien</h2><p>Automatisez la création de devis et de missions, suivez vos convoyages en temps réel et récupérez vos documents — le tout depuis vos propres outils.</p></div>
        <div className="developer-grid">{capabilities.map(({ Icon, title, description, tag }) => <article className="developer-card" key={title}><div className="developer-card-icon"><Icon size={23} /></div><h3>{title}</h3><p>{description}</p><code>{tag}</code></article>)}</div>
        <div className="developer-code"><div><h3>Simple à intégrer</h3><p>Une API REST, des réponses JSON et une authentification par clé secrète envoyée depuis votre serveur.</p><pre>{`curl https://api.transportsligneo.fr/v1/quotes/estimate \
  -H "Authorization: Bearer ••••••••••••" \
  -H "Content-Type: application/json" \
  -d '{ "pickup_address": "...", "delivery_address": "..." }'`}</pre></div><div><h3>Une réponse claire</h3><p>Chaque appel renvoie une estimation instantanée, sans engagement, prête à être affichée dans votre outil.</p><pre>{`{
  "distance_km": 465,
  "duration_estimate": "5h48",
  "price_ttc": 342.00,
  "currency": "EUR"
}`}</pre></div></div>
        <p className="developer-note">Exemples illustratifs — la documentation technique complète et vos clés API sont disponibles dans votre espace professionnel.</p>
      </section>
      <section className="developer-gate"><LockKeyhole size={27} /><h2>La documentation complète est réservée à votre espace pro</h2><p>Référence détaillée des endpoints, codes de statut, gestion des webhooks et vos clés API personnelles — tout est disponible une fois connecté.</p><div><Link className="developer-button developer-button-light" to="/login"><KeyRound size={17} /> Accéder à mon espace pro</Link><Link className="developer-button developer-button-ghost" to="/inscription-pro"><Check size={17} /> Créer un compte professionnel</Link></div></section>
    </main>
    <Footer />
  </>;
}
