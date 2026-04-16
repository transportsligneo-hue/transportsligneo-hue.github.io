import { Shield, Clock, Euro, Users, Award, Headphones } from "lucide-react";

const reasons = [
  {
    icon: Shield,
    title: "Fiabilité garantie",
    desc: "0 annulation de notre part. Chaque mission est assurée et suivie de bout en bout.",
  },
  {
    icon: Clock,
    title: "Rapidité d'exécution",
    desc: "Prise en charge possible en moins de 24h selon la distance et la disponibilité.",
  },
  {
    icon: Euro,
    title: "Tarifs transparents",
    desc: "Péages et carburant inclus. Aucun frais caché, devis instantané en ligne.",
  },
  {
    icon: Users,
    title: "Convoyeurs professionnels",
    desc: "Équipe salariée, formée en continu, avec convoyeur indépendant formé en renfort. Tenue professionnelle obligatoire.",
  },
  {
    icon: Award,
    title: "+6 ans d'expérience",
    desc: "Un savoir-faire éprouvé auprès de concessionnaires, loueurs et particuliers.",
  },
  {
    icon: Headphones,
    title: "Disponible 7j/7",
    desc: "Un interlocuteur dédié pour répondre à vos besoins à tout moment.",
  },
];

export default function PourquoiNousChoisir() {
  return (
    <section className="py-24 section-bg">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Pourquoi nous choisir
          </h2>
          <p className="text-cream/60 mt-4 max-w-lg mx-auto text-sm">
            Des engagements concrets pour un service d'exception.
          </p>
          <div className="gold-divider-short mt-4" />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((r, i) => (
            <div
              key={i}
              className="card-premium p-8 rounded text-center group hover:border-primary/40 transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-full gold-border flex items-center justify-center mx-auto mb-5 group-hover:border-primary/60 transition-colors">
                <r.icon className="text-primary group-hover:text-gold-light transition-colors" size={24} />
              </div>
              <h3 className="font-heading text-primary tracking-[0.1em] uppercase text-sm mb-3">
                {r.title}
              </h3>
              <p className="text-cream/65 text-sm leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>

        {/* Badges marketing */}
        <div className="flex flex-wrap justify-center gap-4 mt-12">
          {["Service rapide", "Disponible 7j/7", "Assurance incluse", "Devis gratuit"].map((badge) => (
            <span
              key={badge}
              className="px-5 py-2 gold-border rounded-full text-xs uppercase tracking-wider text-primary font-heading"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
