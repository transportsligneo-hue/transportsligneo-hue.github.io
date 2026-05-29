import { Link } from "@tanstack/react-router";
import { Calendar, Tag, Zap, ShieldCheck, Wallet, Clock3 } from "lucide-react";
import heroBg from "@/assets/hero-ligneo-night.jpg";
import { scrollToDevis } from "@/lib/scroll-to-devis";

/**
 * Hero desktop premium — image pleine largeur + headline gauche.
 * Refonte calée sur la maquette : trust pills intégrées au hero
 * sous les CTAs, respiration accrue.
 */
export default function HeroDesktop() {
  const trustPills = [
    { icon: Zap, label: "Réponse immédiate" },
    { icon: ShieldCheck, label: "Assurance incluse" },
    { icon: Wallet, label: "Péages & carburant inclus" },
    { icon: Clock3, label: "Disponible 7j/7" },
  ];

  return (
    <section
      id="accueil"
      className="relative min-h-[92vh] overflow-hidden pt-24 bg-[#0b1026]"
    >
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt="Convoyeur Transports Ligneo photographiant un véhicule premium"
          className="w-full h-full object-cover object-[center_30%] md:object-[40%_center]"
          width={1920}
          height={1080}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(11,16,38,0.94) 0%, rgba(11,16,38,0.82) 28%, rgba(11,16,38,0.50) 55%, rgba(11,16,38,0.28) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-48"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(11,16,38,0.98) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-8 xl:px-12 pt-14 pb-32 min-h-[80vh] flex items-center">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-px w-12 bg-[#e7c76a]" />
            <span className="text-[#e7c76a] text-[11px] tracking-[0.32em] uppercase font-medium">
              Convoyage automobile premium
            </span>
          </div>

          <h1 className="font-heading text-white text-5xl xl:text-6xl 2xl:text-7xl tracking-wide leading-[1.05]">
            LA TRANQUILLITÉ
            <br />
            SUR <span className="text-[#e7c76a]">TOUTE LA LIGNE.</span>
          </h1>

          <p className="text-cream/85 text-base xl:text-lg leading-relaxed mt-8 max-w-xl">
            Transports Ligneo, spécialiste du convoyage automobile. Nous
            déplaçons votre véhicule avec rigueur, discrétion et passion,
            partout en France et en Europe.
          </p>

          <div className="flex flex-wrap gap-4 mt-10">
            <button
              type="button"
              onClick={() => scrollToDevis()}
              className="edl-cta-gold inline-flex items-center gap-3 px-8 py-4 font-heading text-[12px] tracking-[0.22em] uppercase"
            >
              <Calendar size={16} />
              Estimer mon trajet
            </button>
            <Link
              to="/tarifs"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl border border-[rgba(231,199,106,0.5)] text-cream font-heading text-[12px] tracking-[0.22em] uppercase hover:bg-white/5 hover:border-[#e7c76a] transition-all"
            >
              <Tag size={16} />
              Voir les tarifs
            </Link>
          </div>

          <ul className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
            {trustPills.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[rgba(231,199,106,0.35)] bg-[rgba(231,199,106,0.08)]">
                  <Icon size={13} className="text-[#e7c76a]" strokeWidth={2.2} />
                </span>
                <span className="text-cream/85 text-[12.5px] tracking-[0.04em]">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
