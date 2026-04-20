import { Link } from "@tanstack/react-router";
import {
  User,
  Briefcase,
  Home,
  Plane,
  Wrench,
  Building2,
  Handshake,
  ShieldCheck,
  Truck,
  HardHat,
  ArrowRight,
} from "lucide-react";

const particuliers = [
  {
    icon: Home,
    title: "Livraison à domicile",
    desc: "Votre véhicule récupéré et livré directement chez vous, partout en France.",
  },
  {
    icon: Plane,
    title: "Déménagement / mutation",
    desc: "Idéal pour rejoindre votre nouveau lieu de vie sans contrainte de transport.",
  },
  {
    icon: Wrench,
    title: "Aller-retour atelier",
    desc: "Convoyage vers votre garagiste ou concession, retour inclus.",
  },
  {
    icon: ShieldCheck,
    title: "Achat / vente à distance",
    desc: "Récupération du véhicule chez le vendeur, livraison sécurisée chez vous.",
  },
];

const professionnels = [
  {
    icon: Building2,
    title: "Concessionnaires",
    desc: "Transferts inter-agences, livraisons clients finaux, préparation et stockage temporaire.",
  },
  {
    icon: Handshake,
    title: "Loueurs courte/longue durée",
    desc: "Restitutions, redéploiements de flotte, gestion des retours fin de contrat.",
  },
  {
    icon: ShieldCheck,
    title: "Compagnies d'assurance",
    desc: "Rapatriement de véhicules accidentés ou immobilisés, partout en France.",
  },
  {
    icon: HardHat,
    title: "Chantiers & sites sensibles",
    desc: "Livraison sur sites à haut risque ou chantiers (utilitaires, véhicules pros).",
  },
  {
    icon: Truck,
    title: "Flottes d'entreprise",
    desc: "Gestion sur-mesure de votre parc : prise en charge groupée et suivi dédié.",
  },
  {
    icon: Briefcase,
    title: "Partenariats sur-mesure",
    desc: "Tarification négociée, interlocuteur dédié, reporting mensuel.",
  },
];

function ServiceCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="card-premium p-6 rounded group hover:border-primary/40 transition-all duration-300 flex flex-col">
      <div className="w-12 h-12 rounded-xl gold-border flex items-center justify-center bg-primary/5 mb-4">
        <Icon className="text-primary" size={22} />
      </div>
      <h3 className="font-heading text-primary tracking-[0.05em] text-base md:text-lg mb-2">
        {title}
      </h3>
      <p className="text-cream/65 text-sm leading-relaxed flex-1">{desc}</p>
      <Link
        to="/tarifs"
        className="mt-5 inline-flex items-center gap-2 text-primary text-xs font-heading tracking-[0.15em] uppercase hover:text-gold-light transition-colors"
      >
        Demander un devis <ArrowRight size={14} />
      </Link>
    </div>
  );
}

export default function ServicesContent() {
  return (
    <>
      {/* Hero */}
      <section className="py-20 md:py-24 section-bg">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="gold-divider-short mb-4 mx-auto" />
          <h1 className="font-heading text-3xl md:text-5xl tracking-[0.1em] uppercase text-primary">
            Nos services
          </h1>
          <p className="text-cream/70 mt-5 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Une réponse pour chaque besoin de convoyage : des particuliers
            aux flottes professionnelles, partout en France et en Europe.
          </p>
          <div className="gold-divider-short mt-5 mx-auto" />
        </div>
      </section>

      {/* Particuliers */}
      <section className="py-16 md:py-20 section-bg-alt">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-3 max-w-3xl mx-auto justify-center">
            <User className="text-primary" size={20} />
            <p className="font-heading text-primary/80 text-xs tracking-[0.3em] uppercase">
              Pour les particuliers
            </p>
          </div>
          <h2 className="font-heading text-2xl md:text-3xl text-center text-primary tracking-[0.05em] mb-3">
            Votre véhicule livré, sans contrainte
          </h2>
          <p className="text-cream/60 text-sm md:text-base text-center max-w-2xl mx-auto mb-12">
            Déménagement, achat à distance, mise au garage : nous prenons en charge
            l'intégralité du trajet, péages et carburant inclus.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {particuliers.map((s, i) => (
              <ServiceCard key={i} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* Professionnels */}
      <section className="py-16 md:py-20 section-bg">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-3 max-w-3xl mx-auto justify-center">
            <Briefcase className="text-primary" size={20} />
            <p className="font-heading text-primary/80 text-xs tracking-[0.3em] uppercase">
              Pour les professionnels
            </p>
          </div>
          <h2 className="font-heading text-2xl md:text-3xl text-center text-primary tracking-[0.05em] mb-3">
            Un partenaire dédié à votre activité
          </h2>
          <p className="text-cream/60 text-sm md:text-base text-center max-w-2xl mx-auto mb-12">
            Concessionnaires, loueurs, assureurs, gestionnaires de flotte :
            nous structurons une réponse sur-mesure pour fluidifier votre activité.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {professionnels.map((s, i) => (
              <ServiceCard key={i} {...s} />
            ))}
          </div>

          <div className="mt-12 text-center card-premium p-8 rounded gold-border-strong max-w-3xl mx-auto">
            <p className="text-cream/80 text-sm md:text-base mb-5">
              Vous gérez une flotte ou cherchez un partenariat récurrent&nbsp;?
              Construisons ensemble une offre dédiée.
            </p>
            <Link
              to="/pro"
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors"
            >
              Demander une offre B2B <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
