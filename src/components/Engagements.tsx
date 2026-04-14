import { Clock, Award, Globe, GraduationCap, Shield, Eye } from "lucide-react";
import franceMapImg from "@/assets/france-map-flyer.png";

const engagements = [
  { icon: Shield, title: "Sécurité", text: "Assurance circulation incluse sur chaque mission, véhicule protégé de A à Z." },
  { icon: Clock, title: "Ponctualité", text: "Récupération en moins de 24h selon distance. Respect strict des délais." },
  { icon: Eye, title: "Transparence", text: "Tarifs clairs, péages et carburant inclus. Suivi en temps réel." },
  { icon: Award, title: "Expérience", text: "Plus de 6 ans d'expertise dans le convoyage automobile." },
  { icon: Globe, title: "Couverture nationale", text: "Intervention en France entière et partout en Europe." },
  { icon: GraduationCap, title: "Professionnalisme", text: "Convoyeurs salariés, formés en continu, tenue professionnelle." },
];

export default function Engagements() {
  return (
    <section id="engagements" className="py-24 section-bg-alt">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Nos engagements
          </h2>
          <p className="text-cream/60 mt-4 max-w-lg mx-auto text-sm">
            Sécurité, ponctualité et transparence à chaque mission.
          </p>
          <div className="gold-divider-short mt-4" />
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Engagements cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {engagements.map((e, i) => (
              <div
                key={i}
                className="card-premium p-5 rounded group hover:border-primary/40 transition-colors duration-300"
              >
                <e.icon className="text-primary mb-3 group-hover:text-gold-light transition-colors" size={20} />
                <h3 className="font-heading text-primary tracking-[0.1em] uppercase text-xs mb-2">
                  {e.title}
                </h3>
                <p className="text-cream/60 text-xs leading-relaxed">{e.text}</p>
              </div>
            ))}
          </div>

          {/* Carte de France */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={franceMapImg}
                alt="Carte de France — Basé à Tours"
                className="w-64 md:w-80 rounded object-contain"
                loading="lazy"
                width={358}
                height={301}
              />
            </div>
            <div className="mt-6 text-center">
              <p className="font-heading text-primary tracking-[0.15em] text-lg">
                Basé à Tours (37)
              </p>
              <p className="text-cream/50 text-xs mt-1">
                Au cœur du réseau routier national
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
