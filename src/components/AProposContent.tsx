import { Award, Heart, ShieldCheck, Sparkles, Target, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

const valeurs = [
  { icon: ShieldCheck, title: "Fiabilité", desc: "Zéro annulation de notre part. Chaque mission est traitée avec le même niveau d'exigence." },
  { icon: Heart, title: "Proximité", desc: "Un interlocuteur dédié, joignable, qui vous tient informé de chaque étape." },
  { icon: Sparkles, title: "Excellence", desc: "Tenue professionnelle, véhicule rendu propre, mise en main soignée." },
  { icon: Target, title: "Flexibilité", desc: "Soir, week-end, urgence : nous nous adaptons à votre cadence." },
];

const stats = [
  { value: "2 300+", label: "Missions réalisées" },
  { value: "500 000+", label: "Kilomètres parcourus" },
  { value: "98 %", label: "Clients satisfaits" },
  { value: "5 ans", label: "D'expérience terrain" },
];

export default function AProposContent() {
  return (
    <>
      {/* Hero À propos */}
      <section className="py-20 md:py-28 section-bg">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="gold-divider-short mb-4 mx-auto" />
          <p className="font-heading text-cream/55 text-xs tracking-[0.3em] uppercase">
            Notre histoire
          </p>
          <h1 className="font-heading text-3xl md:text-5xl tracking-[0.1em] uppercase text-primary mt-4">
            Le convoyage,<br />une affaire de confiance
          </h1>
          <p className="text-cream/75 text-base md:text-lg mt-6 leading-relaxed max-w-2xl mx-auto">
            Depuis 2019, <span className="text-primary">Transports Ligneo</span> accompagne particuliers,
            concessionnaires et loueurs dans le convoyage de leurs véhicules à travers la France.
            Une promesse simple : votre véhicule, livré comme s'il était le nôtre.
          </p>
          <div className="gold-divider-short mt-6 mx-auto" />
        </div>
      </section>

      {/* Notre histoire */}
      <section className="py-20 section-bg-alt">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div>
              <p className="font-heading text-primary/70 text-xs tracking-[0.3em] uppercase mb-3">
                Origine
              </p>
              <h2 className="font-heading text-2xl md:text-3xl text-primary tracking-[0.05em] mb-5">
                Une vision née sur le terrain
              </h2>
              <div className="space-y-4 text-cream/75 text-sm md:text-base leading-relaxed">
                <p>
                  L'aventure démarre à Tours, en 2019. Après plusieurs années passées
                  à constater les écarts de qualité du convoyage automobile, le constat
                  est clair : il manque un acteur réellement <span className="text-primary">premium</span>,
                  capable d'allier rigueur, transparence tarifaire et relation humaine.
                </p>
                <p>
                  Transports Ligneo naît de cette ambition. Une structure à taille humaine,
                  des convoyeurs salariés formés en continu, une assurance circulation
                  incluse, et une exigence absolue sur la prise en main du véhicule.
                </p>
                <p>
                  Six ans plus tard, l'entreprise est devenue le partenaire de référence
                  de plusieurs concessionnaires, loueurs et particuliers exigeants
                  partout en France.
                </p>
              </div>
            </div>

            {/* Bloc fondateur */}
            <div className="card-premium p-8 rounded gold-border-strong">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-full gold-border flex items-center justify-center bg-primary/10">
                  <Users className="text-primary" size={28} />
                </div>
                <div>
                  <p className="font-heading text-primary text-lg tracking-wide">
                    Olivier G.
                  </p>
                  <p className="text-cream/55 text-xs tracking-wider uppercase">
                    Fondateur & dirigeant
                  </p>
                </div>
              </div>
              <p className="text-cream/75 text-sm leading-relaxed italic">
                « Chaque véhicule qui nous est confié est un engagement personnel.
                Notre métier, c'est avant tout une question de confiance — celle qu'un
                client place entre nos mains, et que nous lui rendons à l'arrivée. »
              </p>
              <div className="gold-divider-short mt-6" />
              <div className="grid grid-cols-2 gap-4 mt-6 text-center">
                <div>
                  <p className="font-heading text-primary text-2xl">2021</p>
                  <p className="text-cream/50 text-[10px] uppercase tracking-wider mt-1">Création</p>
                </div>
                <div>
                  <p className="font-heading text-primary text-2xl">Tours</p>
                  <p className="text-cream/50 text-[10px] uppercase tracking-wider mt-1">Siège social</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="py-20 section-bg">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="gold-divider-short mb-4 mx-auto" />
            <h2 className="font-heading text-2xl md:text-3xl tracking-[0.2em] uppercase text-primary">
              En quelques chiffres
            </h2>
            <div className="gold-divider-short mt-4 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {stats.map((s, i) => (
              <div key={i} className="card-premium p-6 md:p-8 rounded text-center gold-border">
                <p className="font-heading gold-gradient-text text-3xl md:text-4xl mb-2">
                  {s.value}
                </p>
                <p className="text-cream/60 text-xs md:text-sm tracking-wider uppercase">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 section-bg-alt">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-6">
          <div className="card-premium p-8 rounded">
            <Target className="text-primary mb-4" size={28} />
            <h3 className="font-heading text-primary tracking-[0.1em] uppercase text-sm mb-3">
              Notre mission
            </h3>
            <p className="text-cream/75 text-sm leading-relaxed">
              Acheminer chaque véhicule, partout en France et en Europe,
              avec le même niveau d'exigence : ponctualité, propreté, traçabilité,
              et une communication transparente du début à la fin.
            </p>
          </div>
          <div className="card-premium p-8 rounded">
            <Award className="text-primary mb-4" size={28} />
            <h3 className="font-heading text-primary tracking-[0.1em] uppercase text-sm mb-3">
              Notre vision
            </h3>
            <p className="text-cream/75 text-sm leading-relaxed">
              Devenir la référence française du convoyage automobile premium.
              Un service où la technologie (suivi GPS, inspection digitalisée,
              espace client) sert avant tout l'humain et la qualité.
            </p>
          </div>
        </div>
      </section>

      {/* Valeurs */}
      <section className="py-20 section-bg">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="gold-divider-short mb-4 mx-auto" />
            <h2 className="font-heading text-2xl md:text-3xl tracking-[0.2em] uppercase text-primary">
              Nos valeurs
            </h2>
            <div className="gold-divider-short mt-4 mx-auto" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {valeurs.map((v, i) => (
              <div key={i} className="card-premium p-6 rounded text-center hover:border-primary/40 transition-colors">
                <div className="w-12 h-12 rounded-full gold-border flex items-center justify-center mx-auto mb-4 bg-primary/5">
                  <v.icon className="text-primary" size={20} />
                </div>
                <h3 className="font-heading text-primary tracking-[0.1em] uppercase text-xs mb-2">
                  {v.title}
                </h3>
                <p className="text-cream/65 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 section-bg-alt">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-cream/70 text-base mb-6">
            Envie d'en savoir plus, ou de nous confier votre prochain trajet ?
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/tarifs"
              className="px-8 py-3 bg-primary text-primary-foreground font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors"
            >
              Estimer un trajet
            </Link>
            <Link
              to="/contact"
              className="px-8 py-3 gold-border text-primary font-heading text-xs tracking-[0.15em] uppercase hover:bg-primary/10 transition-colors"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
