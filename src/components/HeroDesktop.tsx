import { Link } from "@tanstack/react-router";
import { Calendar, Tag, Zap, ShieldCheck, Wallet, Clock3 } from "lucide-react";
import heroBg from "@/assets/hero-ligneo-night.jpg";
import { scrollToDevis } from "@/lib/scroll-to-devis";
import DevisGenerator from "@/components/DevisGenerator";

/**
 * Hero desktop premium 2-colonnes :
 * - Image hero pleine largeur en fond (intacte)
 * - Colonne gauche : eyebrow + headline + body + CTAs + trust pills dorées
 * - Colonne droite : carte sombre arrondie du simulateur (DevisGenerator variant="hero-card")
 * - Bord inférieur : arrondi blanc cassé qui "accueille" la section suivante (maquette)
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
      className="relative overflow-hidden pt-24 bg-[#0b1026]"
    >
      {/* Image de fond */}
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt="Convoyeur Transports Ligneo photographiant un véhicule premium"
          className="w-full h-full object-cover object-[center_30%] lg:object-[35%_center]"
          width={1920}
          height={1080}
        />
        {/* Overlay dégradé navy → léger droite pour lisibilité texte + carte */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(11,16,38,0.94) 0%, rgba(11,16,38,0.78) 35%, rgba(11,16,38,0.55) 65%, rgba(11,16,38,0.65) 100%)",
          }}
        />
      </div>

      {/* Contenu hero */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 xl:px-14 pt-10 pb-40 lg:pb-48">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_minmax(420px,1fr)] gap-10 lg:gap-12 xl:gap-16 items-center min-h-[72vh]">
          {/* Colonne gauche : contenu éditorial */}
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-px w-12 bg-[#e7c76a]" />
              <span className="text-[#e7c76a] text-[11px] tracking-[0.32em] uppercase font-medium">
                Convoyage automobile premium
              </span>
            </div>

            <h1 className="font-heading text-white text-5xl xl:text-6xl 2xl:text-[68px] tracking-wide leading-[1.05]">
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

            {/* Trust pills dorées */}
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

          {/* Colonne droite : Simulateur en carte premium sombre */}
          <div id="devis" className="relative scroll-mt-32">
            {/* Halo doré derrière la carte */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-4 rounded-[32px] opacity-60 blur-2xl"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(231,199,106,0.22), transparent 70%)",
              }}
            />
            <div className="relative">
              <DevisGenerator variant="hero-card" />
            </div>
          </div>
        </div>
      </div>

      {/* Courbe blanc cassé : accueille la section stats suivante (façon maquette) */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-20 lg:h-24"
        style={{
          background: "var(--surface-cream, #faf7ef)",
          borderTopLeftRadius: "48px",
          borderTopRightRadius: "48px",
        }}
      />
    </section>
  );
}
