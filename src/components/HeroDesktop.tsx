import { Link } from "@tanstack/react-router";
import { ArrowDown, Tag, ShieldCheck, Sparkles } from "lucide-react";
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

      <div className="relative z-10 max-w-5xl mx-auto px-8 xl:px-12 pb-20 min-h-[80vh] flex items-center">
        <div className="w-full">
          <div className="edl-card-strong p-8 xl:p-12 relative text-center">
            {/* Logo watermark */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-8 top-8 w-[140px] h-[140px] opacity-[0.07]"
              style={{
                backgroundImage: `url(${logoLigneo})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundSize: "contain",
              }}
            />

            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="edl-chip">
                <Sparkles size={12} />
                Estimation instantanée
              </span>
            </div>

            <h1 className="font-heading text-5xl xl:text-6xl 2xl:text-7xl tracking-wide leading-[1.05] gold-gradient-text">
              TRANSPORTS LIGNEO
            </h1>

            <p className="font-heading text-2xl xl:text-3xl text-[#e7c76a] italic mt-5">
              « La tranquillité sur toute la ligne. »
            </p>

            <p className="text-cream/85 text-base xl:text-lg leading-relaxed mt-5 max-w-2xl mx-auto">
              Convoyage automobile premium au départ de Tours. Obtenez votre estimation
              en moins de 30 secondes — prix transparent, assurance tous risques incluse.
            </p>

            <div className="flex flex-wrap gap-3 mt-8 justify-center">
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

            <div className="mt-8 pt-6 border-t border-[rgba(95,182,255,0.15)] flex flex-wrap gap-x-6 gap-y-2 justify-center text-cream/75 text-xs xl:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#e7c76a]" />
                Péages & carburant inclus
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#5fb6ff]" />
                Assurance tous risques
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
