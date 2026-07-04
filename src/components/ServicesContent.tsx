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
  Car,
  ClipboardCheck,
  PenLine,
  PackageCheck,
  Search,
  Zap,
  Repeat,
  Sparkles,
  Warehouse,
} from "lucide-react";

const jockeyage = [
  { icon: ClipboardCheck, title: "Jockeyage contrôle technique", desc: "On récupère votre véhicule, on passe le CT, et on vous le ramène. Tarif réduit vs convoyage standard." },
  { icon: Plane, title: "Jockeyage départ vacances", desc: "Récupération à votre domicile, livraison à la gare, l'aéroport ou tout point de départ — restitution au retour." },
  { icon: Wrench, title: "Jockeyage révision / atelier", desc: "On emmène votre véhicule chez votre garagiste ou concession, on récupère après intervention." },
];

const convoyage = [
  { icon: Home, title: "Convoyage porte à porte", desc: "Prise en charge et livraison directement à l'adresse de votre choix, partout en France et en Europe." },
  { icon: Repeat, title: "Livraison + restitution", desc: "Aller simple, ou livraison puis restitution sur deuxième plaque — pratique pour location, prêt, événement." },
  { icon: Truck, title: "Véhicule sur plateau", desc: "Véhicule non roulant ou zéro kilomètre : transport sécurisé sur plateau (+70% sur la part transport)." },
];

const digital = [
  { icon: ClipboardCheck, title: "État des lieux digitalisé", desc: "Capture complète 360° du véhicule avant et après convoyage, photos horodatées et géolocalisées." },
  { icon: PenLine, title: "Signature électronique", desc: "Devis, EDL et bon de livraison signés en ligne, valeur probante, archivage automatique." },
  { icon: PackageCheck, title: "Livraison sécurisée", desc: "Suivi GPS temps réel, convoyeur identifié, assurance tous risques incluse." },
  { icon: Search, title: "Recherche véhicule par plaque", desc: "Saisie de la plaque d'immatriculation pour récupérer automatiquement marque, modèle et énergie." },
  { icon: Zap, title: "Devis instantané en 3 secondes", desc: "Estimateur en ligne : départ, arrivée, véhicule — tarif clair et engageant immédiatement." },
];

const extras = [
  { icon: Sparkles, title: "Lavage extérieur", desc: "Carrosserie nettoyée avant remise.", price: "24€ TTC" },
  { icon: Sparkles, title: "Lavage intérieur + extérieur", desc: "Nettoyage complet, prêt à rouler.", price: "59€ TTC" },
  { icon: Warehouse, title: "Stockage sécurisé", desc: "Gardiennage en site clos, durée à la demande.", price: "Sur devis" },
];

const professionnels = [
  { icon: Building2, title: "Concessionnaires", desc: "Transferts inter-agences, livraisons clients finaux, préparation et stockage temporaire." },
  { icon: Handshake, title: "Loueurs courte/longue durée", desc: "Restitutions, redéploiements de flotte, gestion des retours fin de contrat." },
  { icon: ShieldCheck, title: "Compagnies d'assurance", desc: "Rapatriement de véhicules accidentés ou immobilisés, partout en France." },
  { icon: HardHat, title: "Chantiers & sites sensibles", desc: "Livraison sur sites à haut risque ou chantiers (utilitaires, véhicules pros)." },
  { icon: Truck, title: "Flottes d'entreprise", desc: "Gestion sur-mesure de votre parc : prise en charge groupée et suivi dédié." },
  { icon: Briefcase, title: "Partenariats sur-mesure", desc: "Tarification négociée, interlocuteur dédié, reporting mensuel." },
];

function ServiceCardLight({ icon: Icon, title, desc, price }: { icon: React.ElementType; title: string; desc: string; price?: string }) {
  return (
    <div className="card-premium-light group relative flex flex-col p-7 transition-all duration-500 hover:-translate-y-1">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#b8860b]">
        <Icon size={20} />
      </div>
      <h3 className="font-heading text-[#0b1026] text-[17px] tracking-wide mb-2">{title}</h3>
      <p className="text-[#0b1026]/65 text-[13.5px] leading-relaxed flex-1">{desc}</p>
      {price && (
        <p className="mt-4 font-heading text-[#b8860b] text-[15px] tracking-wide">{price}</p>
      )}
      <Link
        to="/tarifs"
        className="mt-5 inline-flex items-center gap-2 text-[#b8860b] text-[10.5px] font-heading tracking-[0.24em] uppercase hover:text-[#0b1026] transition-colors"
      >
        Demander un devis <ArrowRight size={13} />
      </Link>
    </div>
  );
}

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

function SectionLabel({ icon: Icon, children, tone = "gold" }: { icon: React.ElementType; children: React.ReactNode; tone?: "gold" | "ink" }) {
  const cls = tone === "gold" ? "text-[#e7c76a]" : "text-[#b8860b]";
  return (
    <span className={`inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.28em] ${cls} font-heading`}>
      <Icon size={13} /> {children}
    </span>
  );
}

export default function ServicesContent() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section
        className="relative overflow-hidden pt-28 pb-28 lg:pt-36 lg:pb-36"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(231,199,106,0.10), transparent 70%)" }} />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/[0.08] px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">
            Convoyage
          </span>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-wide text-cream mt-6 leading-[1.1]">
            Nos <span className="gold-gradient-text">services</span>
          </h1>
          <p className="text-cream/70 mt-6 text-base lg:text-lg leading-relaxed max-w-2xl mx-auto">
            Jockeyage, convoyage porte à porte, état des lieux digitalisé, signature électronique : un service complet pour particuliers et professionnels.
          </p>
        </div>

        <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "120px" }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M0,80 C320,20 760,5 1080,30 C1240,42 1360,70 1440,55 L1440,120 L0,120 Z"
              fill="var(--surface-cream, #faf7ef)" />
          </svg>
        </div>
      </section>

      {/* ===== JOCKEYAGE — cream ===== */}
      <section className="py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionLabel icon={Car} tone="ink">Jockeyage</SectionLabel>
            <h2 className="font-heading text-3xl lg:text-4xl text-[#0b1026] mt-3">
              On prend votre véhicule, on le ramène
            </h2>
            <p className="text-[#0b1026]/65 text-sm lg:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
              Tarif allégé par rapport au convoyage standard : remise appliquée automatiquement dans l'estimateur.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {jockeyage.map((s, i) => <ServiceCardLight key={i} {...s} />)}
          </div>
        </div>
      </section>

      {/* ===== CONVOYAGE — navy ===== */}
      <section
        className="relative py-20 lg:py-24"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionLabel icon={Truck}>Convoyage automobile</SectionLabel>
            <h2 className="font-heading text-3xl lg:text-4xl text-cream mt-3">
              Porte à porte, partout en France
            </h2>
            <p className="text-cream/65 text-sm lg:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
              Roulant, non roulant, zéro km : nous adaptons le mode de transport à votre véhicule.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {convoyage.map((s, i) => <ServiceCardDark key={i} {...s} />)}
          </div>
        </div>
      </section>

      {/* ===== DIGITAL — cream ===== */}
      <section className="py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionLabel icon={ShieldCheck} tone="ink">Plateforme digitale</SectionLabel>
            <h2 className="font-heading text-3xl lg:text-4xl text-[#0b1026] mt-3">
              Une expérience 100% digitalisée
            </h2>
            <p className="text-[#0b1026]/65 text-sm lg:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
              De la recherche véhicule à la signature de l'EDL, tout se passe en ligne — clair, rapide, traçable.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {digital.map((s, i) => <ServiceCardLight key={i} {...s} />)}
          </div>
        </div>
      </section>

      {/* ===== OPTIONS / TARIFS COURTS — navy ===== */}
      <section
        className="relative py-20 lg:py-24"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionLabel icon={Sparkles}>Options & services additionnels</SectionLabel>
            <h2 className="font-heading text-3xl lg:text-4xl text-cream mt-3">
              Personnalisez votre prestation
            </h2>
            <p className="text-cream/65 text-sm lg:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
              Lavage, stockage, recharge batterie ou mise de carburant — disponibles directement depuis l'estimateur.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {extras.map((s, i) => (
              <div key={i} className="relative flex flex-col p-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm transition-all duration-500 hover:border-[#e7c76a]/40">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#e7c76a]">
                  <s.icon size={20} />
                </div>
                <h3 className="font-heading text-cream text-[17px] tracking-wide mb-2">{s.title}</h3>
                <p className="text-cream/60 text-[13.5px] leading-relaxed flex-1">{s.desc}</p>
                <p className="mt-4 font-heading text-[#e7c76a] text-[15px] tracking-wide">{s.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PROS — cream ===== */}
      <section className="py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionLabel icon={Briefcase} tone="ink">Pour les professionnels</SectionLabel>
            <h2 className="font-heading text-3xl lg:text-4xl text-[#0b1026] mt-3">
              Un partenaire dédié à votre activité
            </h2>
            <p className="text-[#0b1026]/65 text-sm lg:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
              Concessionnaires, loueurs, assureurs, gestionnaires de flotte : nous structurons une réponse sur-mesure.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {professionnels.map((s, i) => <ServiceCardLight key={i} {...s} />)}
          </div>

          <div className="mt-16 text-center max-w-3xl mx-auto p-9 rounded-2xl border border-[#e7c76a]/40 bg-white/60 backdrop-blur-sm">
            <p className="text-[#0b1026]/80 text-base lg:text-lg leading-relaxed mb-6">
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
