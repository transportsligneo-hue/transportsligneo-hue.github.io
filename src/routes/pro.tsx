import { createFileRoute, Link } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Truck, FileText, Users, Zap, Building2, Warehouse, Clock,
  LayoutDashboard, Calendar, BarChart3, MapPin,
} from "lucide-react";

export const Route = createFileRoute("/pro")({
  component: ProPage,
  head: () => ({
    meta: [
      { title: "Solutions B2B convoyage · Concessions, loueurs, flottes | Transports Ligneo" },
      { name: "description", content: "Une plateforme dédiée aux pros pour piloter vos convoyages, votre facturation et vos équipes depuis un seul espace." },
      { property: "og:title", content: "Solutions B2B · Transports Ligneo" },
      { property: "og:description", content: "Concessions, loueurs, gestionnaires de flotte : le convoyage à l'échelle de votre parc." },
      { property: "og:url", content: "https://transportsligneo.fr/pro" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/pro" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: "Transports Ligneo · Solutions B2B de convoyage",
          url: "https://transportsligneo.fr/pro",
          description:
            "Une plateforme dédiée aux pros pour piloter vos convoyages, votre facturation et vos équipes depuis un seul espace.",
          areaServed: { "@type": "Country", name: "France" },
          address: { "@type": "PostalAddress", addressLocality: "Tours", addressCountry: "FR" },
        }),
      },
    ],
  }),
});

const audiences = [
  { Icon: Building2, title: "Concessions", desc: "Transferts inter-sites, livraisons clients, restitutions : gagnez du temps sur vos flux quotidiens." },
  { Icon: Truck, title: "Loueurs", desc: "Repositionnement de véhicules entre agences, restitution en fin de contrat, gestion de pics saisonniers." },
  { Icon: Clock, title: "Gestionnaires de flotte", desc: "Pilotage complet du parc : missions groupées, planification récurrente, reporting par site." },
];

const features = [
  { Icon: LayoutDashboard, title: "Tableau de bord dédié", desc: "Vue d'ensemble de vos missions en cours, terminées et à venir, en temps réel." },
  { Icon: Calendar, title: "Missions groupées", desc: "Déplacez plusieurs véhicules de votre parc en une seule commande planifiée." },
  { Icon: Users, title: "Utilisateurs & sites", desc: "Gérez les accès par site : chaque responsable ne voit que son périmètre." },
  { Icon: BarChart3, title: "Reporting détaillé", desc: "Coûts, délais et volumes par site, exportables en un clic." },
  { Icon: MapPin, title: "Suivi temps réel", desc: "Position GPS, statut et ETA pour chaque mission, accessibles à tout moment." },
  { Icon: FileText, title: "Documents centralisés", desc: "Devis, factures, états des lieux et signatures, tous archivés au même endroit." },
];

function ProPage() {
  return (
    <>
      <Navbar />
      <main>
        <div className="r4-page">
          {/* HERO split */}
          <div className="v4-b2b-hero">
            <div>
              <div className="v4-hero-eyebrow v"><span className="dot" />Solutions professionnelles</div>
              <h1>Le convoyage à l'échelle de <span className="v4-accent v">votre flotte</span>.</h1>
              <p>Concessions, loueurs, gestionnaires de parc : une plateforme dédiée pour piloter vos convoyages, votre facturation et vos équipes depuis un seul espace.</p>
              <div className="v4-hero-actions">
                <Link to="/contact" className="v4-btn-primary v">Devenir partenaire</Link>
                <Link to="/contact" className="v4-btn-outline">Parler à un conseiller</Link>
              </div>
            </div>
            <div className="v4-hero-panel">
              <div className="v4-row">
                <div className="v4-row-ic"><Warehouse size={17} /></div>
                <div className="v4-row-text"><div className="t">Gestion de flotte centralisée</div><div className="s">Tous vos véhicules, un seul tableau de bord</div></div>
              </div>
              <div className="v4-row">
                <div className="v4-row-ic"><FileText size={17} /></div>
                <div className="v4-row-text"><div className="t">Facturation consolidée</div><div className="s">Une facture mensuelle, par site</div></div>
              </div>
              <div className="v4-row">
                <div className="v4-row-ic"><Users size={17} /></div>
                <div className="v4-row-text"><div className="t">Interlocuteur dédié</div><div className="s">Un contact unique, joignable 7j/7</div></div>
              </div>
              <div className="v4-row">
                <div className="v4-row-ic"><Zap size={17} /></div>
                <div className="v4-row-text"><div className="t">Tarifs préférentiels</div><div className="s">Selon volume et récurrence</div></div>
              </div>
            </div>
          </div>

          {/* Pour qui */}
          <div className="v4-section">
            <div className="v4-section-head">
              <div className="v4-hero-eyebrow v" style={{ justifyContent: "center", width: "100%" }}>
                <span className="dot" />Pour qui ?
              </div>
              <h2>Une solution pour chaque professionnel</h2>
            </div>
            <div className="v4-audience-grid">
              {audiences.map(({ Icon, title, desc }) => (
                <div key={title} className="v4-aud-card">
                  <div className="v4-aud-ic"><Icon size={21} /></div>
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Fonctionnalités */}
          <div className="v4-section">
            <div className="v4-section-head">
              <div className="v4-hero-eyebrow v" style={{ justifyContent: "center", width: "100%" }}>
                <span className="dot" />Fonctionnalités
              </div>
              <h2>Une plateforme pensée pour les pros</h2>
            </div>
            <div className="v4-feat-grid">
              {features.map(({ Icon, title, desc }) => (
                <div key={title} className="v4-feat-card">
                  <div className="v4-feat-ic"><Icon size={19} /></div>
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="v4-cta-box">
            <div className="v4-hero-eyebrow v" style={{ justifyContent: "center", width: "100%" }}>
              <span className="dot" />Devenir partenaire
            </div>
            <h2>Discutons de vos besoins de convoyage</h2>
            <p>Un conseiller dédié vous accompagne pour construire une offre adaptée à votre volume et à vos contraintes.</p>
            <Link to="/contact" className="v4-btn-primary v">Demander un rendez-vous</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
