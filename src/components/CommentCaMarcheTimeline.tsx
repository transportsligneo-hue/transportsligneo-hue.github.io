import { Link } from "@tanstack/react-router";
import { FileText, Car, MapPin, CheckCircle, ShieldCheck, Clock } from "lucide-react";

const steps = [
  {
    icon: FileText,
    n: "01",
    title: "Réservation",
    desc: "Estimez votre trajet en ligne en moins de 30 secondes. Validez votre devis, communiquez les informations du véhicule et choisissez votre date de prise en charge.",
    bullets: ["Estimation instantanée", "Devis transparent", "Confirmation par email"],
  },
  {
    icon: Car,
    n: "02",
    title: "Prise en charge",
    desc: "Notre convoyeur dédié récupère votre véhicule à l'endroit convenu. Inspection complète, photos contradictoires et mise en main soignée.",
    bullets: ["Inspection 360°", "État des lieux signé", "Communication directe"],
  },
  {
    icon: MapPin,
    n: "03",
    title: "Livraison",
    desc: "Votre véhicule est conduit par un professionnel formé, suivi en temps réel, puis remis au destinataire avec inspection finale et compte-rendu.",
    bullets: ["Suivi GPS", "Livraison ponctuelle", "Compte-rendu complet"],
  },
];

export default function CommentCaMarcheTimeline() {
  return (
    <>
      {/* Hero */}
      <section className="py-20 md:py-24 section-bg">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="gold-divider-short mb-4 mx-auto" />
          <h1 className="font-heading text-3xl md:text-5xl tracking-[0.1em] uppercase text-primary">
            Comment ça marche
          </h1>
          <p className="text-cream/70 mt-5 text-base md:text-lg leading-relaxed">
            De la réservation à la livraison, un processus simple, fluide et transparent.
          </p>
          <div className="gold-divider-short mt-5 mx-auto" />
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 md:py-20 section-bg-alt">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative">
            {/* Ligne verticale (desktop + mobile) */}
            <div
              className="absolute left-6 md:left-1/2 top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-primary/40"
              aria-hidden
            />

            <div className="space-y-10 md:space-y-16">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const isLeft = i % 2 === 0;
                return (
                  <div key={i} className="relative md:grid md:grid-cols-2 md:gap-12 items-center">
                    {/* Pastille */}
                    <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-10">
                      <div className="w-12 h-12 rounded-full bg-navy gold-border-strong flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.25)]">
                        <Icon className="text-primary" size={20} />
                      </div>
                    </div>

                    {/* Contenu — alterné sur desktop, toujours à droite sur mobile */}
                    <div
                      className={`pl-20 md:pl-0 ${
                        isLeft ? "md:pr-12 md:text-right" : "md:col-start-2 md:pl-12"
                      }`}
                    >
                      <p className="font-heading text-primary/50 text-sm tracking-[0.3em] mb-1">
                        Étape {step.n}
                      </p>
                      <h2 className="font-heading text-2xl md:text-3xl text-primary tracking-[0.05em] mb-3">
                        {step.title}
                      </h2>
                      <p className="text-cream/75 text-sm md:text-base leading-relaxed mb-4">
                        {step.desc}
                      </p>
                      <ul
                        className={`space-y-2 ${
                          isLeft ? "md:flex md:flex-col md:items-end" : ""
                        }`}
                      >
                        {step.bullets.map((b, j) => (
                          <li
                            key={j}
                            className={`flex items-center gap-2 text-cream/65 text-sm ${
                              isLeft ? "md:flex-row-reverse" : ""
                            }`}
                          >
                            <CheckCircle size={14} className="text-primary shrink-0" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Spacer côté opposé sur desktop */}
                    <div className={isLeft ? "hidden md:block md:col-start-2" : "hidden md:block md:col-start-1 md:row-start-1"} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Réassurance */}
      <section className="py-16 section-bg">
        <div className="max-w-4xl mx-auto px-6 grid sm:grid-cols-3 gap-4">
          {[
            { icon: ShieldCheck, label: "Assurance incluse" },
            { icon: Clock, label: "Disponible 7j/7" },
            { icon: CheckCircle, label: "0 annulation" },
          ].map((r, i) => (
            <div key={i} className="card-premium p-5 rounded text-center">
              <r.icon className="text-primary mx-auto mb-2" size={22} />
              <p className="text-cream/75 text-xs font-heading tracking-wider uppercase">
                {r.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 section-bg-alt">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-cream/70 text-base mb-6">
            Prêt à confier votre véhicule ?
          </p>
          <Link
            to="/tarifs"
            className="px-10 py-4 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors inline-block"
          >
            Estimer mon trajet
          </Link>
        </div>
      </section>
    </>
  );
}
