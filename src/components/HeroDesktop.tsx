import { Link } from "@tanstack/react-router";
import { Calendar, Tag } from "lucide-react";
import heroCar from "@/assets/hero-chauffeur-ligneo.jpg";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

/**
 * Hero desktop premium — version 2 colonnes (texte gauche / voiture droite).
 * Ce composant n'est rendu QUE sur desktop (md+). La version mobile reste
 * inchangée via MobileHomeScreen.
 */
export default function HeroDesktop() {
  return (
    <section
      id="accueil"
      className="relative min-h-screen overflow-hidden section-bg"
    >
      {/* Cadres décoratifs dorés */}
      <div className="absolute top-24 left-8 w-20 h-20 border-t border-l border-primary/30 pointer-events-none" />
      <div className="absolute bottom-8 left-8 w-20 h-20 border-b border-l border-primary/30 pointer-events-none" />
      <div className="absolute bottom-8 right-8 w-20 h-20 border-b border-r border-primary/30 pointer-events-none" />

      {/* Image lifestyle — colonne droite, fondue dans le navy */}
      <div className="absolute inset-y-0 right-0 w-[58%] xl:w-[60%]">
        <img
          src={heroCar}
          alt="Chauffeur Transports LIGNEO photographiant une Mercedes noire devant une villa au coucher de soleil"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "65% center" }}
          width={1920}
          height={1080}
          fetchPriority="high"
        />
        {/* Dégradé navy → image renforcé pour lisibilité du texte */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #0b1026 0%, rgba(11,16,38,0.92) 22%, rgba(11,16,38,0.55) 42%, rgba(11,16,38,0.15) 65%, rgba(11,16,38,0) 80%)",
          }}
        />
        {/* Voile sombre global pour homogénéiser */}
        <div className="absolute inset-0 bg-navy/25" />
        {/* Vignette bas */}
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,16,38,0) 0%, #0b1026 100%)",
          }}
        />
      </div>

      {/* Contenu */}
      <div className="relative z-10 max-w-7xl mx-auto px-10 xl:px-16 pt-40 pb-24 min-h-screen flex items-center">
        <div className="max-w-xl xl:max-w-2xl relative">
          {/* Logo en watermark, centré au-dessus du wordmark */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-24 xl:-top-28 w-[260px] xl:w-[320px] h-[260px] xl:h-[320px] opacity-[0.13]"
            style={{
              backgroundImage: `url(${logoLigneo})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "contain",
              filter: "blur(0.3px) saturate(1.05)",
            }}
          />
          <div className="h-px w-16 bg-primary mb-8 relative" />

          <h1 className="font-heading text-5xl xl:text-6xl 2xl:text-7xl tracking-wide leading-[1.05] gold-gradient-text relative">
            TRANSPORTS
            <br />
            LIGNEO
          </h1>

          <p className="font-heading text-2xl xl:text-3xl text-primary italic mt-6">
            « La tranquillité sur toute la ligne. »
          </p>

          <div className="mt-8 space-y-3">
            <p className="text-cream text-lg tracking-wide">
              Votre véhicule, notre priorité.
            </p>
            <p className="text-cream/80 text-base leading-relaxed max-w-lg">
              De la prise en charge à la restitution, nous vous tenons informés
              à chaque étape.
            </p>
            <p className="text-cream/60 text-sm max-w-lg">
              Un service premium, assuré avec rigueur et discrétion.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 mt-10">
            <Link
              to="/contact"
              className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground font-heading text-sm tracking-[0.2em] uppercase shadow-lg shadow-primary/20 hover:bg-gold-light hover:shadow-primary/40 transition-all duration-300"
            >
              <Calendar size={16} />
              Demander un devis
            </Link>
            <Link
              to="/tarifs"
              className="inline-flex items-center gap-3 px-8 py-4 gold-border-strong text-primary font-heading text-sm tracking-[0.2em] uppercase hover:bg-primary/10 transition-colors duration-300"
            >
              <Tag size={16} />
              Voir les tarifs
            </Link>
          </div>
        </div>
      </div>

      {/* Coin haut-droit doré (au-dessus de l'image) */}
      <div className="absolute top-24 right-8 w-20 h-20 border-t border-r border-primary/40 pointer-events-none z-20" />
    </section>
  );
}
