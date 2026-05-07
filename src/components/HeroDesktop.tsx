import { Link } from "@tanstack/react-router";
import { Calendar, Tag } from "lucide-react";
import heroBg from "@/assets/hero-ligneo-night.jpg";

/**
 * Hero desktop premium — image pleine largeur, headline gauche
 * "LA TRANQUILLITÉ SUR TOUTE LA LIGNE." (TOUTE LA LIGNE en doré).
 */
export default function HeroDesktop() {
  return (
    <section
      id="accueil"
      className="relative min-h-[88vh] overflow-hidden pt-24 bg-[#0b1026]"
    >
      {/* Image de fond */}
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt="Convoyeur Transports Ligneo photographiant un véhicule premium"
          className="w-full h-full object-cover object-center"
          width={1920}
          height={1080}
        />
        {/* Overlay sombre + dégradé gauche pour lisibilité du texte */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(11,16,38,0.92) 0%, rgba(11,16,38,0.78) 30%, rgba(11,16,38,0.45) 55%, rgba(11,16,38,0.25) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(11,16,38,0.95) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-8 xl:px-12 pt-10 pb-24 min-h-[78vh] flex items-center">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-5">
            <span className="h-px w-10 bg-[#e7c76a]" />
            <span className="text-[#e7c76a] text-xs tracking-[0.3em] uppercase font-medium">
              Votre véhicule, notre priorité
            </span>
          </div>

          <h1 className="font-heading text-white text-5xl xl:text-6xl 2xl:text-7xl tracking-wide leading-[1.05]">
            LA TRANQUILLITÉ
            <br />
            SUR{" "}
            <span className="text-[#e7c76a]">TOUTE LA LIGNE.</span>
          </h1>

          <p className="text-cream/85 text-base xl:text-lg leading-relaxed mt-7 max-w-xl">
            Transports Ligneo, spécialiste du convoyage automobile.
            Nous déplaçons votre véhicule avec rigueur, discrétion et passion,
            partout en France et en Europe.
          </p>

          <div className="flex flex-wrap gap-4 mt-9">
            <a
              href="#devis"
              className="edl-cta inline-flex items-center gap-3 px-7 py-4 font-heading text-sm tracking-[0.2em] uppercase"
            >
              <Calendar size={16} />
              Demander un devis
            </a>
            <Link
              to="/tarifs"
              className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl border border-[rgba(231,199,106,0.45)] text-cream font-heading text-sm tracking-[0.2em] uppercase hover:bg-white/5 hover:border-[#e7c76a] transition-all"
            >
              <Tag size={16} />
              Voir les tarifs
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
