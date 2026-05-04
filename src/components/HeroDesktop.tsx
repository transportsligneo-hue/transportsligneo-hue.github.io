import { Link } from "@tanstack/react-router";
import { ArrowDown, Tag, ShieldCheck, Sparkles } from "lucide-react";
import heroCar from "@/assets/hero-chauffeur-ligneo.jpg";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

/**
 * Hero desktop premium — style "Inspection Driver" (edl-shell + edl-card-strong).
 * L'estimation est l'action principale : CTA scrolle vers #devis intégré dans la page.
 */
export default function HeroDesktop() {
  return (
    <section
      id="accueil"
      className="relative min-h-[92vh] overflow-hidden edl-section-bg pt-24"
    >
      {/* Halo électrique décoratif */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(44,107,255,0.30), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-20 right-0 w-[460px] h-[460px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(95,182,255,0.22), transparent)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-8 xl:px-12 pb-20 grid grid-cols-12 gap-8 items-center min-h-[80vh]">
        {/* === Colonne gauche : pitch + CTA === */}
        <div className="col-span-12 lg:col-span-7 relative">
          <div className="edl-card-strong p-8 xl:p-10 relative">
            {/* Logo watermark */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-6 top-6 w-[120px] h-[120px] opacity-[0.08]"
              style={{
                backgroundImage: `url(${logoLigneo})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundSize: "contain",
              }}
            />

            <div className="flex items-center gap-2 mb-5">
              <span className="edl-chip">
                <Sparkles size={12} />
                Estimation instantanée
              </span>
              <span className="edl-chip-gold">
                <ShieldCheck size={12} />
                Péages & carburant inclus
              </span>
            </div>

            <h1 className="font-heading text-5xl xl:text-6xl 2xl:text-7xl tracking-wide leading-[1.05] gold-gradient-text">
              TRANSPORTS
              <br />
              LIGNEO
            </h1>

            <p className="font-heading text-2xl xl:text-3xl text-[#e7c76a] italic mt-5">
              « La tranquillité sur toute la ligne. »
            </p>

            <p className="text-cream/85 text-base xl:text-lg leading-relaxed mt-5 max-w-xl">
              Convoyage automobile premium au départ de Tours. Obtenez votre estimation
              en moins de 30 secondes — prix transparent, péages et carburant inclus.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <a
                href="#devis"
                className="edl-cta inline-flex items-center gap-3 px-8 py-4 font-heading text-sm tracking-[0.2em] uppercase"
              >
                <ArrowDown size={16} />
                Estimer mon trajet
              </a>
              <Link
                to="/tarifs"
                className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl border border-[rgba(95,182,255,0.40)] text-cream font-heading text-sm tracking-[0.2em] uppercase hover:bg-white/5 hover:border-[rgba(95,182,255,0.70)] transition-all"
              >
                <Tag size={16} />
                Voir les tarifs
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-cream/75 text-xs xl:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#5fb6ff]" />
                Assurance incluse
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#5fb6ff]" />
                Devis sous 30 secondes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#5fb6ff]" />
                Disponible 7j/7
              </span>
            </div>
          </div>
        </div>

        {/* === Colonne droite : photo chauffeur en carte glass === */}
        <div className="col-span-12 lg:col-span-5">
          <div className="edl-card-strong overflow-hidden aspect-[4/5] xl:aspect-[3/4] relative">
            <img
              src={heroCar}
              alt="Chauffeur Transports LIGNEO en veste brandée devant une Mercedes noire"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "42% center" }}
              width={1536}
              height={2048}
              fetchPriority="high"
            />
            {/* Voile bas + halo électrique */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(10,19,53,0) 55%, rgba(10,19,53,0.85) 100%)",
              }}
            />
            <div className="absolute bottom-5 left-5 right-5">
              <p className="edl-eyebrow">Votre convoyeur dédié</p>
              <p className="font-heading text-cream text-xl xl:text-2xl mt-1">
                Service premium, assuré avec rigueur.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Indicateur scroll vers l'estimateur */}
      <a
        href="#devis"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-cream/60 hover:text-[#5fb6ff] transition-colors"
        aria-label="Aller à l'estimateur"
      >
        <span className="text-[10px] uppercase tracking-[0.25em]">Estimer</span>
        <ArrowDown size={18} className="animate-bounce" />
      </a>
    </section>
  );
}
