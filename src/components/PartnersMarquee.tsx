import logoCat from "@/assets/logo-cat.png";
import logoTransak from "@/assets/logo-transakauto.png";

const PARTNERS = [
  { src: logoCat, alt: "CAT France" },
  { src: logoTransak, alt: "TransakAuto" },
];

/**
 * Carrousel de logos infini façon SaaS (Stripe, Linear).
 * Logos en grayscale, défilement CSS pur, fluide et responsive.
 */
export default function PartnersMarquee() {
  // On duplique la liste pour créer une boucle visuelle continue.
  // Le translateX(-50%) de l'animation fait croire à un défilement infini.
  // Avec seulement 2 logos, on triple pour avoir une largeur suffisante.
  const loop = [...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS];

  return (
    <section className="py-16 md:py-20 edl-section-bg">
      <div className="max-w-6xl mx-auto px-5 md:px-6">
        <div className="text-center mb-10 md:mb-12">
          <p className="edl-eyebrow">Partenaires & clients</p>
          <h2 className="font-heading text-2xl md:text-3xl tracking-wide text-cream mt-2">
            Ils nous font confiance
          </h2>
          <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-[#5fb6ff] to-transparent" />
        </div>

        <div className="logo-marquee-mask overflow-hidden">
          <div className="logo-marquee">
            <div className="logo-marquee-track">
              {loop.map((p, i) => (
                <div
                  key={`a-${i}`}
                  className="shrink-0 flex items-center justify-center h-14 md:h-16"
                >
                  <img
                    src={p.src}
                    alt={p.alt}
                    className="logo-grayscale h-12 md:h-14 w-auto object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))}
            </div>
            {/* duplicat pour boucle continue */}
            <div className="logo-marquee-track" aria-hidden="true">
              {loop.map((p, i) => (
                <div
                  key={`b-${i}`}
                  className="shrink-0 flex items-center justify-center h-14 md:h-16"
                >
                  <img
                    src={p.src}
                    alt=""
                    className="logo-grayscale h-12 md:h-14 w-auto object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
