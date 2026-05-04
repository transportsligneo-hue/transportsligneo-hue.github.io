import { Link } from "@tanstack/react-router";
import { Calendar, Tag, ShieldCheck } from "lucide-react";
import heroCar from "@/assets/hero-chauffeur-ligneo.jpg";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

/**
 * Hero desktop premium — version glassmorphism bleu nuit clair.
 * Image du chauffeur recentrée pour bien voir la mention "Transports Ligneo"
 * sur la veste. Carte glass à gauche pour la lisibilité du texte.
 */
export default function HeroDesktop() {
  return (
    <section
      id="accueil"
      className="relative min-h-screen overflow-hidden home-shell"
    >
      {/* Cadres décoratifs dorés */}
      <div className="absolute top-24 left-8 w-20 h-20 border-t border-l border-primary/30 pointer-events-none" />
      <div className="absolute bottom-8 left-8 w-20 h-20 border-b border-l border-primary/30 pointer-events-none" />
      <div className="absolute bottom-8 right-8 w-20 h-20 border-b border-r border-primary/30 pointer-events-none" />
      <div className="absolute top-24 right-8 w-20 h-20 border-t border-r border-primary/40 pointer-events-none z-20" />

      {/* Image lifestyle — colonne droite, centrée sur la veste du convoyeur */}
      <div className="absolute inset-y-0 right-0 w-[55%] xl:w-[58%]">
        <img
          src={heroCar}
          alt="Chauffeur Transports LIGNEO en veste brandée devant une Mercedes noire"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "42% center" }}
          width={1536}
          height={864}
          fetchPriority="high"
        />
        {/* Dégradé navy clair → image, plus doux pour laisser voir la veste */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #111a3d 0%, rgba(17,26,61,0.85) 18%, rgba(17,26,61,0.35) 38%, rgba(17,26,61,0.05) 60%, rgba(17,26,61,0) 80%)",
          }}
        />
        {/* Voile bleu doux pour cohérence */}
        <div className="absolute inset-0 bg-[#111a3d]/15" />
        {/* Vignette bas pour fondu vers section suivante */}
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              "linear-gradient(180deg, rgba(17,26,61,0) 0%, #111a3d 100%)",
          }}
        />
      </div>

      {/* Contenu — carte glass pour lisibilité absolue */}
      <div className="relative z-10 max-w-7xl mx-auto px-10 xl:px-16 pt-36 pb-20 min-h-screen flex items-center">
        <div className="max-w-xl xl:max-w-2xl relative home-glass-strong p-10 xl:p-12">
          {/* Logo en watermark */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-20 w-[200px] h-[200px] opacity-[0.10]"
            style={{
              backgroundImage: `url(${logoLigneo})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "contain",
            }}
          />
          <div className="h-px w-16 bg-primary mb-6 relative" />

          <h1 className="font-heading text-5xl xl:text-6xl 2xl:text-7xl tracking-wide leading-[1.05] gold-gradient-text relative">
            TRANSPORTS
            <br />
            LIGNEO
          </h1>

          <p className="font-heading text-2xl xl:text-3xl text-primary italic mt-6">
            « La tranquillité sur toute la ligne. »
          </p>

          <div className="mt-6 space-y-3">
            <p className="text-cream text-lg tracking-wide">
              Votre véhicule, notre priorité.
            </p>
            <p className="text-cream/85 text-base leading-relaxed max-w-lg">
              De la prise en charge à la restitution, nous vous tenons informés
              à chaque étape.
            </p>
            <p className="text-cream/65 text-sm max-w-lg">
              Un service premium, assuré avec rigueur et discrétion.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 mt-8">
            <a
              href="#devis"
              className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground font-heading text-sm tracking-[0.2em] uppercase shadow-lg shadow-primary/20 hover:bg-gold-light hover:shadow-primary/40 transition-all duration-300 rounded-xl"
            >
              <Calendar size={16} />
              Estimer mon trajet
            </a>
            <Link
              to="/tarifs"
              className="inline-flex items-center gap-3 px-8 py-4 gold-border-strong text-primary font-heading text-sm tracking-[0.2em] uppercase hover:bg-primary/10 transition-colors duration-300 rounded-xl"
            >
              <Tag size={16} />
              Voir les tarifs
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-2 text-cream/70 text-xs">
            <ShieldCheck size={14} className="text-primary" />
            Péages & carburant inclus · Devis instantané
          </div>
        </div>
      </div>
    </section>
  );
}
