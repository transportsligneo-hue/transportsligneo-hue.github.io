import logoCat from "@/assets/logo-cat.png";
import logoTransak from "@/assets/logo-transakauto.png";
import { Shield, Clock, Award } from "lucide-react";

const logos = [
  { src: logoCat, alt: "CAT France" },
  { src: logoTransak, alt: "TransakAuto" },
];

const reassurance = [
  { icon: Shield, label: "Assurance" },
  { icon: Clock, label: "7j/7" },
  { icon: Award, label: "Premium" },
];

/**
 * Bandeau partenaires + réassurance dédié mobile.
 * Remplace les avis sur la home mobile.
 */
export default function MobilePartnersStrip() {
  return (
    <section className="md:hidden px-5 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-cream/85 text-xs tracking-[0.2em] uppercase">
          Ils nous font confiance
        </h2>
      </div>

      {/* Logos partenaires */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {logos.map((logo, i) => (
          <div
            key={i}
            className="mobile-card h-24 flex items-center justify-center px-4"
          >
            <img
              src={logo.src}
              alt={logo.alt}
              loading="lazy"
              decoding="async"
              className="max-h-14 w-auto object-contain opacity-90"
              style={{ imageRendering: "auto" }}
            />
          </div>
        ))}
      </div>

      {/* Badges réassurance */}
      <div className="grid grid-cols-3 gap-2">
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
