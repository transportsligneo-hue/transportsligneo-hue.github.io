import { Star, Quote } from "lucide-react";

const avis = [
  {
    nom: "Laurent M.",
    role: "Professionnel auto — Tours",
    text: "Honnêtement au début j'étais pas sûr, j'avais déjà eu des mauvaises expériences avec d'autres convoyeurs. Mais là rien à dire, le véhicule est arrivé nickel, dans les temps, et le chauffeur m'a tenu au courant tout du long. Depuis j'ai refait appel à eux 3 fois.",
    stars: 5,
    date: "Mars 2025",
  },
  {
    nom: "Sophie D.",
    role: "Particulière",
    text: "J'ai fait transporter ma voiture de Marseille à Tours après mon déménagement. Prix correct, le convoyeur était ponctuel et sympa. Petit bémol sur le délai de réponse au premier mail (2 jours) mais après c'était carré. Je recommande.",
    stars: 4,
    date: "Janvier 2025",
  },
];

export default function AvisClients() {
  return (
    <section className="py-24 section-bg">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Avis clients
          </h2>
          <p className="text-cream/60 mt-4 max-w-lg mx-auto text-sm">
            La satisfaction de nos clients est notre meilleure carte de visite.
          </p>
          <div className="gold-divider-short mt-4" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {avis.map((a, i) => (
            <div key={i} className="card-premium p-8 rounded relative group hover:border-primary/40 transition-colors duration-300">
              <Quote className="text-primary/15 absolute top-4 right-4" size={40} />
              <div className="flex gap-1 mb-4">
                {Array.from({ length: a.stars }).map((_, j) => (
                  <Star key={j} className="text-primary fill-primary" size={14} />
                ))}
              </div>
              <p className="text-cream/75 text-sm leading-relaxed mb-5 italic">
                « {a.text} »
              </p>
              <div>
                <p className="font-heading text-primary text-sm tracking-wide">{a.nom}</p>
                <p className="text-cream/45 text-xs mt-0.5">{a.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
