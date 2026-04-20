import { Link } from "@tanstack/react-router";
import { FileText, CheckCircle, Truck } from "lucide-react";

const steps = [
  {
    icon: FileText,
    step: "01",
    title: "Estimez votre trajet",
    desc: "Utilisez notre estimateur de trajet pour obtenir une estimation instantanée du prix, de la distance et de la durée.",
  },
  {
    icon: CheckCircle,
    step: "02",
    title: "Demandez un devis",
    desc: "Une fois votre trajet estimé, demandez un devis directement depuis l'estimateur. Toutes les informations sont automatiquement transmises pour un traitement rapide.",
  },
  {
    icon: Truck,
    step: "03",
    title: "Livraison",
    desc: "Nous validons les détails, vous attribuons un convoyeur dédié et votre véhicule est livré à destination.",
  },
];

export default function CommentCaMarche() {
  return (
    <section className="py-24 section-bg-alt">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Comment ça marche
          </h2>
          <p className="text-cream/60 mt-4 max-w-lg mx-auto text-sm">
            Un processus simple, rapide et transparent.
          </p>
          <div className="gold-divider-short mt-4" />
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-20 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          {steps.map((s, i) => (
            <div key={i} className="text-center relative">
              <div className="w-20 h-20 rounded-full gold-border-strong flex items-center justify-center mx-auto mb-6 card-premium relative z-10">
                <s.icon className="text-primary" size={28} />
              </div>
              <span className="font-heading text-primary/40 text-4xl absolute top-0 right-1/4 md:right-auto md:left-[calc(50%+30px)] select-none">
                {s.step}
              </span>
              <h3 className="font-heading text-primary tracking-[0.1em] uppercase text-sm mb-3">
                {s.title}
              </h3>
              <p className="text-cream/65 text-sm leading-relaxed max-w-xs mx-auto">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="text-center mt-10">
          <p className="text-cream/50 text-sm max-w-2xl mx-auto italic">
            Une fois votre trajet estimé, vous pouvez faire une demande de devis directement depuis l'estimateur. Toutes les informations sont automatiquement transmises pour un traitement rapide.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link
            to="/tarifs"
            className="px-10 py-4 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors duration-300 inline-block"
          >
            Estimer mon trajet
          </Link>
        </div>
      </div>
    </section>
  );
}
