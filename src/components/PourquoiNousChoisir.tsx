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
    <section className="py-24 relative" style={{ background: "linear-gradient(180deg, #faf7ef 0%, #f3eee2 100%)" }}>
      {/* Filets dorés haut/bas pour ancrer la section premium */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)" }} />
      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)" }} />

      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="font-heading text-[10px] tracking-[0.35em] uppercase text-[#3b82f6]/80">Notre signature</span>
          <h2 className="font-heading text-3xl md:text-4xl text-[#061238] mt-3 tracking-[0.02em]">
            Pourquoi nous <span className="gold-gradient-text">choisir</span>
          </h2>
          <div className="gold-divider-short mt-5" />
          <p className="text-[#5b6485] mt-5 max-w-lg mx-auto text-sm leading-relaxed">
            Des engagements concrets pour un service d'exception.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {reasons.map((r, i) => (
            <div
              key={i}
              className="card-premium-light p-7 group"
            >
              <div className="w-11 h-11 rounded-lg border border-[#60a5fa]/35 flex items-center justify-center mb-5 bg-gradient-to-br from-[#60a5fa]/12 to-[#60a5fa]/4 group-hover:border-[#60a5fa]/60 transition-colors">
                <r.icon className="text-[#3b82f6]" size={20} strokeWidth={1.75} />
              </div>
              <h3 className="font-heading text-[#061238] text-base tracking-wide mb-2">
                {r.title}
              </h3>
              <p className="text-[#5b6485] text-[13px] leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
