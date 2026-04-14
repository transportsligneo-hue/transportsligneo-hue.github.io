import logoPartners from "@/assets/logo-partners.png";
import { Shield, Clock, Award } from "lucide-react";

const reassurance = [
  { icon: Shield, label: "Assurance incluse" },
  { icon: Clock, label: "Disponible 7j/7" },
  { icon: Award, label: "Service premium" },
];

export default function Confiance() {
  return (
    <section className="py-24 section-bg">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Ils nous font confiance
          </h2>
          <p className="text-cream/60 mt-4 max-w-lg mx-auto text-sm">
            Des professionnels de l'automobile nous font confiance au quotidien.
          </p>
          <div className="gold-divider-short mt-4" />
        </div>

        {/* Logos partenaires — grille propre */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="card-premium p-10 rounded gold-border flex items-center justify-center">
            <img
              src={logoPartners}
              alt="CAT France et TransakAuto — Partenaires de confiance"
              className="h-16 md:h-24 w-auto opacity-90 hover:opacity-100 transition-opacity duration-300"
              loading="lazy"
              width={636}
              height={120}
            />
          </div>
        </div>

        {/* Badges de réassurance */}
        <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
          {reassurance.map((r, i) => (
            <div key={i} className="card-premium p-5 rounded text-center">
              <r.icon className="text-primary mx-auto mb-2" size={22} />
              <p className="text-cream/70 text-xs font-heading tracking-wider uppercase">{r.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
