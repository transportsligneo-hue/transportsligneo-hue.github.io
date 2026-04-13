import { Clock, Award, Globe, GraduationCap } from "lucide-react";
import franceMapImg from "@/assets/france-map-flyer.png";

const engagements = [
  { icon: Clock, text: "Récupération de vos véhicules en moins de 24h (selon distance)" },
  { icon: Award, text: "Plus de 6 ans d'expérience dans le convoyage" },
  { icon: Globe, text: "Intervention en France et partout en Europe" },
  { icon: GraduationCap, text: "Convoyeurs qualifiés avec formation continue" },
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
          <div className="gold-divider-short mt-4" />
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            {engagements.map((e, i) => (
              <div
                key={i}
                className="flex items-start gap-4 card-premium p-5 rounded"
              >
                <e.icon className="text-primary shrink-0 mt-0.5" size={22} />
                <p className="text-cream/85 leading-relaxed">{e.text}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center">
            <img
              src={franceMapImg}
              alt="Carte de France – Tours"
              className="w-64 md:w-80 rounded"
              loading="lazy"
              width={358}
              height={301}
            />
            <p className="mt-4 font-heading text-primary tracking-[0.15em] text-lg">
              Basé à Tours (37)
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
