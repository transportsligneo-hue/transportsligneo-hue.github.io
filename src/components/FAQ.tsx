import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Quels types de véhicules pouvez-vous convoyer ?",
    a: "Nous convoyons tous types de véhicules : citadines, berlines, SUV, utilitaires, véhicules de collection et même poids lourds légers. Contactez-nous pour toute demande spécifique.",
  },
  {
    q: "Les péages et le carburant sont-ils inclus dans le prix ?",
    a: "Oui, nos tarifs incluent systématiquement les péages et le carburant nécessaires au transport de votre véhicule. Aucun frais caché.",
  },
  {
    q: "Quel est le délai de prise en charge ?",
    a: "Selon la distance et la disponibilité, nous pouvons prendre en charge votre véhicule en moins de 24 heures. Pour les missions express, un supplément de 20% s'applique.",
  },
  {
    q: "Vos convoyeurs sont-ils assurés ?",
    a: "Absolument. Tous nos convoyeurs sont couverts par une assurance circulation complète pendant toute la durée du transport.",
  },
  {
    q: "Livrez-vous dans toute la France ?",
    a: "Oui, nous intervenons sur l'ensemble du territoire français et également en Europe. Notre base est à Tours (37), ce qui nous place au cœur du réseau routier national.",
  },
  {
    q: "Comment suivre la livraison de mon véhicule ?",
    a: "De la prise en charge à la restitution, nous vous tenons informé par SMS ou appel à chaque étape clé : départ, en route et arrivée.",
  },
  {
    q: "Proposez-vous un service de plein de carburant ?",
    a: "Oui, nous pouvons effectuer le plein pour le client final à 2,20 €/L (carburant) ou 1,30 €/kWh (électrique).",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 section-bg-alt">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Questions fréquentes
          </h2>
          <div className="gold-divider-short mt-4" />
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="card-premium rounded overflow-hidden transition-colors duration-300 hover:border-primary/30"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
              >
                <span className="text-cream/85 text-sm font-medium pr-4">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-primary shrink-0 transition-transform duration-300 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === i ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="px-6 pb-5 text-cream/60 text-sm leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-cream/50 text-sm mb-4">Vous avez une autre question ?</p>
          <a
            href="#contact"
            className="px-8 py-3 gold-border text-primary font-heading text-sm tracking-[0.15em] uppercase hover:bg-primary/10 transition-colors duration-300 inline-block"
          >
            Contactez-nous
          </a>
        </div>
      </div>
    </section>
  );
}
