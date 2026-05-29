import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ArrowRight } from "lucide-react";

const faqs = [
  { q: "Quels types de véhicules pouvez-vous convoyer ?", a: "Nous convoyons tous types de véhicules : citadines, berlines, SUV, utilitaires, véhicules de collection et même poids lourds légers. Contactez-nous pour toute demande spécifique." },
  { q: "Les péages et le carburant sont-ils inclus dans le prix ?", a: "Oui, nos tarifs incluent systématiquement les péages et le carburant nécessaires au transport de votre véhicule. Aucun frais caché." },
  { q: "Quel est le délai de prise en charge ?", a: "Selon la distance et la disponibilité, nous pouvons prendre en charge votre véhicule en moins de 24 heures. Pour les missions express, un supplément de 20% s'applique." },
  { q: "Vos convoyeurs sont-ils assurés ?", a: "Absolument. Tous nos convoyeurs sont couverts par une assurance circulation complète pendant toute la durée du transport." },
  { q: "Livrez-vous dans toute la France ?", a: "Oui, nous intervenons sur l'ensemble du territoire français et également en Europe. Notre base est à Tours (37), ce qui nous place au cœur du réseau routier national." },
  { q: "Comment suivre la livraison de mon véhicule ?", a: "De la prise en charge à la restitution, nous vous tenons informé par SMS ou appel à chaque étape clé : départ, en route et arrivée." },
  { q: "Proposez-vous un service de plein de carburant ?", a: "Oui, nous pouvons effectuer le plein pour le client final à 2,20 €/L (carburant) ou 1,30 €/kWh (électrique)." },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      className="relative py-20 lg:py-24"
      style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">FAQ</span>
          <h2 className="font-heading text-3xl lg:text-4xl text-cream mt-3">Questions fréquentes</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`rounded-2xl border backdrop-blur-sm overflow-hidden transition-all duration-300 ${
                  isOpen
                    ? "border-[#e7c76a]/40 bg-white/[0.05]"
                    : "border-white/[0.08] bg-white/[0.03] hover:border-[#e7c76a]/25"
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                >
                  <span className="text-cream/90 text-[14.5px] font-medium pr-4">{faq.q}</span>
                  <span
                    className={`w-8 h-8 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#e7c76a] flex items-center justify-center shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <ChevronDown size={15} />
                  </span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}>
                  <p className="px-6 pb-6 text-cream/65 text-[13.5px] leading-relaxed">{faq.a}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-14">
          <p className="text-cream/55 text-sm mb-5">Vous avez une autre question ?</p>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl border border-[#e7c76a]/50 text-cream font-heading text-[11.5px] tracking-[0.24em] uppercase hover:bg-white/5 hover:border-[#e7c76a] transition-all duration-300"
          >
            Contactez-nous <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
