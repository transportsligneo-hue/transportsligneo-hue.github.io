import { Link } from "@tanstack/react-router";
import { Calendar, Tag } from "lucide-react";
import heroCar from "@/assets/hero-car-premium.jpg";
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

      {/* Logo signature en filigrane (centré, opacité faible) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center z-0"
      >
        <img
          src={logoLigneo}
          alt=""
          className="w-[80%] max-w-3xl opacity-[0.07] mix-blend-screen select-none"
        />
      </div>

      {/* Image voiture — colonne droite, fondue dans le navy */}
      <div className="absolute inset-y-0 right-0 w-[58%] xl:w-[60%]">
        <img
          src={heroCar}
          alt="Berline noire premium en route au coucher du soleil"
          className="absolute inset-0 w-full h-full object-cover object-left"
          width={1920}
          height={1080}
          fetchPriority="high"
        />
        {/* Dégradé navy → image pour fondre le bord gauche */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #0b1026 0%, rgba(11,16,38,0.85) 18%, rgba(11,16,38,0.35) 38%, rgba(11,16,38,0) 60%)",
          }}
        />
        {/* Voile sombre global pour homogénéiser */}
        <div className="absolute inset-0 bg-navy/20" />
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
        <div className="max-w-xl xl:max-w-2xl">
          <div className="h-px w-16 bg-primary mb-6" />

          {/* Wordmark texte — le logo graphique est en filigrane derrière */}
          <h1 className="m-0 font-heading text-cream text-5xl xl:text-6xl 2xl:text-7xl tracking-[0.1em] leading-[1.05]">
            TRANSPORTS
            <br />
            <span className="text-primary">LIGNEO</span>
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
