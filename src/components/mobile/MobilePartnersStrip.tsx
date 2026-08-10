import logoCat from "@/assets/logo-cat.png";
import logoTransak from "@/assets/logo-transakauto.png";
import { Shield, Clock, Award } from "lucide-react";

const PARTNERS = [
  { src: logoCat, alt: "CAT France" },
  { src: logoTransak, alt: "TransakAuto" },
];

const reassurance = [
  { icon: Shield, label: "Assurance" },
  { icon: Clock, label: "7j/7" },
  { icon: Award, label: "Haut de gamme" },
];

/**
 * Bandeau partenaires + réassurance dédié mobile.
 * Logos défilants en grayscale, identique au desktop pour cohérence.
 */
export default function MobilePartnersStrip() {
  // Boucle suffisamment longue pour un défilement fluide avec peu de logos
  const loop = [...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS];

  return (
    <section className="md:hidden px-5 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-cream/85 text-xs tracking-[0.2em] uppercase">
          Ils nous font confiance
        </h2>
      </div>

      {/* Marquee logos · même style/grayscale que desktop */}
      <div className="logo-marquee-mask overflow-hidden -mx-5 px-1">
        <div className="logo-marquee">
          <div className="logo-marquee-track">
            {loop.map((p, i) => (
              <div
                key={`a-${i}`}
                className="shrink-0 flex items-center justify-center h-12"
              >
                <img
                  src={p.src}
                  alt={p.alt}
                  loading="lazy"
                  decoding="async"
                  className="logo-grayscale h-10 w-auto object-contain"
                />
              </div>
            ))}
          </div>
          <div className="logo-marquee-track" aria-hidden="true">
            {loop.map((p, i) => (
              <div
                key={`b-${i}`}
                className="shrink-0 flex items-center justify-center h-12"
              >
                <img
                  src={p.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="logo-grayscale h-10 w-auto object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Badges réassurance */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {reassurance.map((r, i) => (
          <div key={i} className="mobile-card p-3 text-center">
            <r.icon className="text-primary mx-auto mb-1" size={16} />
            <p className="text-cream/70 text-[10px] font-heading tracking-wider uppercase">
              {r.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
