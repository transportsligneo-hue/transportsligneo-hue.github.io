import { ArrowLeftRight, Users, Handshake, ShieldCheck, AlertTriangle, HardHat } from "lucide-react";

const prestations = [
  { icon: ArrowLeftRight, title: "Transferts inter-agences" },
  { icon: Users, title: "Livraison pour particuliers et professionnels" },
  { icon: Handshake, title: "Partenariats avec loueurs et concessionnaires" },
  { icon: ShieldCheck, title: "Rapatriement de véhicules (assurances)" },
  { icon: AlertTriangle, title: "Livraison sur site à haut risque" },
  { icon: HardHat, title: "Livraison sur chantiers" },
];

export default function Prestations() {
  return (
    <section id="prestations" className="py-24 section-bg">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Nos prestations
          </h2>
          <div className="gold-divider-short mt-4" />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {prestations.map((p, i) => (
            <div
              key={i}
              className="card-premium p-8 rounded text-center hover:border-primary/40 transition-colors duration-300 group"
            >
              <p.icon className="text-primary mx-auto mb-4 group-hover:text-gold-light transition-colors" size={28} />
              <p className="font-heading text-cream/90 tracking-wide text-sm uppercase">
                {p.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
