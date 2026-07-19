import { useState } from "react";
import { Phone } from "lucide-react";

const faqs = [
  { q: "Quels types de véhicules pouvez-vous convoyer ?", a: "Nous convoyons tous types de véhicules : citadines, berlines, SUV, utilitaires, véhicules de collection et même poids lourds légers. Contactez-nous pour toute demande spécifique." },
  { q: "Les péages et le carburant sont-ils inclus dans le prix ?", a: "Oui, nos tarifs incluent systématiquement les péages et le carburant nécessaires au transport de votre véhicule. Aucun frais caché." },
  { q: "Quel est le délai de prise en charge ?", a: "Selon la distance et la disponibilité, nous pouvons prendre en charge votre véhicule en moins de 24 heures. Pour les missions express, un supplément de 20% s'applique." },
  { q: "Vos convoyeurs sont-ils assurés ?", a: "Absolument. Tous nos convoyeurs sont couverts par une assurance circulation complète pendant toute la durée du transport." },
  { q: "Livrez-vous dans toute la France ?", a: "Oui, nous intervenons sur l'ensemble du territoire français et également en Europe. Notre base est à Tours (37), au cœur du réseau routier national." },
  { q: "Comment suivre la livraison de mon véhicule ?", a: "De la prise en charge à la restitution, nous vous tenons informé par SMS ou appel à chaque étape clé : départ, en route et arrivée." },
  { q: "Proposez-vous un service de plein de carburant ?", a: "Oui, nous pouvons effectuer le plein pour le client final à 2,20 €/L (carburant) ou 1,30 €/kWh (électrique)." },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div className="r4-page">
      <div className="v4-faq-section">
        <div className="v4-faq-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />FAQ
          </div>
          <h2>Questions fréquentes</h2>
        </div>
        {faqs.map((f, i) => (
          <div key={f.q} className={`v4-faq-item ${open === i ? "v4-open" : ""}`}>
            <button type="button" className="v4-faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
              <span>{f.q}</span>
              <span className="plus">{open === i ? "−" : "+"}</span>
            </button>
            {open === i && <div className="v4-faq-a">{f.a}</div>}
          </div>
        ))}
      </div>

      <div className="v4-cta-strip">
        <div className="v4-cta-inner">
          <div>
            <h4>Vous avez une autre question ?</h4>
            <p>Notre équipe répond 7j/7, sans robot ni attente.</p>
          </div>
          <a href="tel:0782456181" className="v4-call-btn" style={{ margin: 0 }}>
            <Phone size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
            Appeler maintenant
          </a>
        </div>
      </div>
    </div>
  );
}
