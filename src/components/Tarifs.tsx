import { Check, Star } from "lucide-react";

const nosPlus = [
  "Équipe de convoyeurs salariés",
  "Convoyeur attitré pour vos livraisons",
  "Tenue professionnelle",
  "Formation en présentiel et continue de nos convoyeurs",
  "Adaptation à vos process et à la présentation des véhicules",
  "0 annulation de notre part (sauf cas de force majeure)",
  "Livraison sur lieu de travail",
  "Livraison à domicile",
  "Livraison sur sites à hauts risques",
  "Assurance circulation incluse",
  "Possibilité de stocker les véhicules et les préparer avant livraison",
];

export default function Tarifs() {
  return (
    <section id="tarifs" className="py-24 section-bg-alt">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Tarification
          </h2>
          <div className="gold-divider-short mt-4" />
        </div>

        {/* Main pricing highlight */}
        <div className="text-center mb-16 card-premium p-10 pb-12 rounded max-w-2xl mx-auto gold-border-strong overflow-visible">
          <p className="font-heading text-5xl md:text-6xl gold-gradient-text mb-2 leading-tight">
            0,85 €<span className="text-2xl">/km</span>
          </p>
          <p className="text-cream/70 text-sm mt-2">Pour les trajets de plus de 200 km</p>
          <p className="text-primary text-sm mt-3 font-medium tracking-wide">
            Péages &amp; carburant inclus
          </p>
          <p className="text-cream/50 text-xs mt-2">
            Options supplémentaires possibles selon vos besoins
          </p>
        </div>

        {/* Detailed pricing */}
        <div className="text-center mb-12">
          <h3 className="font-heading text-xl tracking-[0.15em] uppercase text-primary">
            Tarifs détaillés
          </h3>
          <div className="gold-divider-short mt-3" />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="card-premium p-8 rounded">
            <h4 className="font-heading text-primary tracking-[0.1em] uppercase text-sm mb-6">
              Tours &amp; Département 37
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-primary/10 pb-3">
                <span className="text-cream/80 text-sm">Livraison + restitution</span>
                <span className="font-heading text-primary text-lg">129 €</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-cream/80 text-sm">Livraison simple</span>
                <span className="font-heading text-primary text-lg">79 €</span>
              </div>
            </div>
          </div>

          <div className="card-premium p-8 rounded">
            <h4 className="font-heading text-primary tracking-[0.1em] uppercase text-sm mb-6">
              Hors Département 37
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-primary/10 pb-3">
                <span className="text-cream/80 text-sm">Frais kilométriques</span>
                <span className="font-heading text-primary text-lg">1 €/km</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-cream/80 text-sm">À partir de 200 km</span>
                <span className="font-heading text-primary text-lg">0,85 €/km</span>
              </div>
            </div>
          </div>

          <div className="card-premium p-8 rounded">
            <h4 className="font-heading text-primary tracking-[0.1em] uppercase text-sm mb-6">
              Options
            </h4>
            <div className="space-y-3 text-sm">
              {[
                ["Mise en main du véhicule", "19,90 €"],
                ["Livraison hors horaires / week-end / express (24h)", "+20 %"],
                ["Lavage intérieur", "29,90 €"],
                ["Lavage intérieur + extérieur", "79,90 €"],
                ["Plein de carburant (client final)", "2,20 €/L"],
                ["Plein électrique", "1,30 €/kWh"],
              ].map(([label, price], i) => (
                <div key={i} className="flex justify-between items-center border-b border-primary/10 pb-2 last:border-0">
                  <span className="text-cream/75">{label}</span>
                  <span className="text-primary font-medium shrink-0 ml-4">{price}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-premium p-8 rounded">
            <h4 className="font-heading text-primary tracking-[0.1em] uppercase text-sm mb-6">
              Informations complémentaires
            </h4>
            <ul className="space-y-3 text-sm text-cream/75">
              <li>Péages et carburant inclus pour le transport</li>
              <li>Possibilité d'effectuer le plein pour le client final</li>
              <li>Stockage de vos véhicules : <span className="text-primary">5,90 €/jour</span></li>
              <li>À partir de 3 jours : <span className="text-primary">3 €/jour</span> supplémentaire (hors utilitaires et poids lourds)</li>
            </ul>
          </div>
        </div>

        {/* Nos Plus */}
        <div className="card-premium p-10 rounded gold-border-strong max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Star className="text-primary" size={20} />
            <h4 className="font-heading text-primary tracking-[0.15em] uppercase">
              Nos plus
            </h4>
            <Star className="text-primary" size={20} />
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
            {nosPlus.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <Check className="text-primary shrink-0 mt-0.5" size={16} />
                <span className="text-cream/80 text-sm leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
