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
  { icon: Home, title: "Livraison à domicile", desc: "Votre véhicule récupéré et livré directement chez vous, partout en France." },
  { icon: Plane, title: "Déménagement / mutation", desc: "Idéal pour rejoindre votre nouveau lieu de vie sans contrainte de transport." },
  { icon: Wrench, title: "Aller-retour atelier", desc: "Convoyage vers votre garagiste ou concession, retour inclus." },
  { icon: ShieldCheck, title: "Achat / vente à distance", desc: "Récupération du véhicule chez le vendeur, livraison sécurisée chez vous." },
];

const professionnels = [
  { icon: Building2, title: "Concessionnaires", desc: "Transferts inter-agences, livraisons clients finaux, préparation et stockage temporaire." },
  { icon: Handshake, title: "Loueurs courte/longue durée", desc: "Restitutions, redéploiements de flotte, gestion des retours fin de contrat." },
  { icon: ShieldCheck, title: "Compagnies d'assurance", desc: "Rapatriement de véhicules accidentés ou immobilisés, partout en France." },
  { icon: HardHat, title: "Chantiers & sites sensibles", desc: "Livraison sur sites à haut risque ou chantiers (utilitaires, véhicules pros)." },
  { icon: Truck, title: "Flottes d'entreprise", desc: "Gestion sur-mesure de votre parc : prise en charge groupée et suivi dédié." },
  { icon: Briefcase, title: "Partenariats sur-mesure", desc: "Tarification négociée, interlocuteur dédié, reporting mensuel." },
];

/** Carte claire cream — alignée homepage */
function ServiceCardLight({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="card-premium-light group relative flex flex-col p-7 transition-all duration-500 hover:-translate-y-1">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#b8860b]">
        <Icon size={20} />
      </div>
      <h3 className="font-heading text-[#0b1026] text-[17px] tracking-wide mb-2">{title}</h3>
      <p className="text-[#0b1026]/65 text-[13.5px] leading-relaxed flex-1">{desc}</p>
      <Link
        to="/tarifs"
        className="mt-5 inline-flex items-center gap-2 text-[#b8860b] text-[10.5px] font-heading tracking-[0.24em] uppercase hover:text-[#0b1026] transition-colors"
      >
        Demander un devis <ArrowRight size={13} />
      </Link>
    </div>
  );
}

/** Carte glass navy — alignée homepage */
function ServiceCardDark({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="group relative flex flex-col p-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm transition-all duration-500 hover:border-[#e7c76a]/40 hover:bg-white/[0.05]">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#e7c76a]">
        <Icon size={20} />
      </div>
      <h3 className="font-heading text-cream text-[17px] tracking-wide mb-2">{title}</h3>
      <p className="text-cream/60 text-[13.5px] leading-relaxed flex-1">{desc}</p>
      <Link
        to="/tarifs"
        className="mt-5 inline-flex items-center gap-2 text-[#e7c76a] text-[10.5px] font-heading tracking-[0.24em] uppercase hover:text-cream transition-colors"
      >
        Demander un devis <ArrowRight size={13} />
      </Link>
    </div>
  );
}

export default function ServicesContent() {
  return (
    <>
      {/* ===== HERO navy premium avec courbe cream ===== */}
      <section
        className="relative overflow-hidden pt-28 pb-28 lg:pt-36 lg:pb-36"
        style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(231,199,106,0.10), transparent 70%)" }} />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/[0.08] px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">
            Convoyage premium
          </span>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-wide text-cream mt-6 leading-[1.1]">
            Nos <span className="gold-gradient-text">services</span>
          </h1>
          <p className="text-cream/70 mt-6 text-base lg:text-lg leading-relaxed max-w-2xl mx-auto">
            Une réponse pour chaque besoin de convoyage : des particuliers aux flottes professionnelles, partout en France et en Europe.
          </p>
        </div>

        {/* courbe cream organique */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "120px" }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M0,80 C320,20 760,5 1080,30 C1240,42 1360,70 1440,55 L1440,120 L0,120 Z"
              fill="var(--surface-cream, #faf7ef)" />
          </svg>
        </div>
      </section>

      {/* ===== Particuliers — section cream ===== */}
      <section className="py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.28em] text-[#b8860b] font-heading">
              <User size={13} /> Pour les particuliers
            </span>
            <h2 className="font-heading text-3xl lg:text-4xl text-[#0b1026] mt-3">
              Votre véhicule livré, sans contrainte
            </h2>
            <p className="text-[#0b1026]/65 text-sm lg:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
              Déménagement, achat à distance, mise au garage : nous prenons en charge l'intégralité du trajet, péages et carburant inclus.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {particuliers.map((s, i) => <ServiceCardLight key={i} {...s} />)}
          </div>
        </div>
      </section>

      {/* ===== Professionnels — section navy ===== */}
      <section
        className="relative py-20 lg:py-24"
        style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">
              <Briefcase size={13} /> Pour les professionnels
            </span>
            <h2 className="font-heading text-3xl lg:text-4xl text-cream mt-3">
              Un partenaire dédié à votre activité
            </h2>
            <p className="text-cream/65 text-sm lg:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
              Concessionnaires, loueurs, assureurs, gestionnaires de flotte : nous structurons une réponse sur-mesure pour fluidifier votre activité.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {professionnels.map((s, i) => <ServiceCardDark key={i} {...s} />)}
          </div>

          <div className="mt-16 text-center max-w-3xl mx-auto p-9 rounded-2xl border border-[#e7c76a]/30 bg-white/[0.03] backdrop-blur-sm">
            <p className="text-cream/80 text-base lg:text-lg leading-relaxed mb-6">
              Vous gérez une flotte ou cherchez un partenariat récurrent ?
              <br className="hidden sm:block" />
              Construisons ensemble une offre dédiée.
            </p>
            <Link
              to="/b2b"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#e7c76a] via-[#d4af37] to-[#e7c76a] bg-[length:200%_100%] hover:bg-[position:100%_0] text-[#0b1026] font-heading text-[11.5px] tracking-[0.24em] uppercase shadow-[0_15px_40px_-12px_rgba(231,199,106,0.55)] transition-all duration-300"
            >
              Demander une offre B2B <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
