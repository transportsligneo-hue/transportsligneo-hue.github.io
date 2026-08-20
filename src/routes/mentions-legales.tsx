import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, Copyright, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/mentions-legales")({
  component: MentionsLegalesPage,
  head: () => ({
    meta: [
      { title: "Mentions légales · Transports Ligneo" },
      { name: "description", content: "Éditeur, hébergement, propriété intellectuelle et responsabilité du site Transports Ligneo, convoyage automobile à Tours." },
      { property: "og:title", content: "Mentions légales · Transports Ligneo" },
      { property: "og:description", content: "Éditeur, propriété intellectuelle et responsabilité du site Transports Ligneo, convoyage automobile à Tours." },
      { property: "og:url", content: "https://transportsligneo.fr/mentions-legales" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/mentions-legales" }],
  }),
});

const sections = [
  {
    icon: Building2,
    title: "Éditeur du site",
    body: (
      <p>
        Transports LIGNEO<br />SIREN : 753 320 001<br />Siège social : Tours (37), France<br />
        Téléphone : 07 82 45 61 81<br />Email : contact@transportsligneo.fr<br />
        Site : www.transportsligneo.fr
      </p>
    ),
  },
  {
    icon: Copyright,
    title: "Propriété intellectuelle",
    body: <p>L'ensemble des contenus (textes, images, logos) présents sur ce site sont la propriété exclusive de Transports LIGNEO, sauf mention contraire. Toute reproduction est interdite sans autorisation préalable.</p>,
  },
  {
    icon: ShieldAlert,
    title: "Responsabilité",
    body: <p>Transports LIGNEO s'efforce de fournir des informations exactes et à jour. Toutefois, la société ne saurait être tenue responsable des erreurs ou omissions.</p>,
  },
];

function MentionsLegalesPage() {
  return (
    <div className="r4-page min-h-screen">
      <section className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[#9aa6c9] hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Retour à l'accueil
        </Link>

        <div className="r4-eyebrow mb-5 inline-flex">
          <span className="r4-eyebrow-dot" />
          Document légal
        </div>
        <h1
          className="font-heading font-extrabold text-white text-4xl md:text-5xl leading-[1.05] tracking-tight mb-4"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Mentions Légales
        </h1>
        <p className="text-[#9aa6c9] text-[15.5px] leading-relaxed max-w-2xl mb-12">
          Informations légales relatives à l'éditeur du site transportsligneo.fr.
        </p>

        <div className="grid gap-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <article
                key={s.title}
                className="glass-onyx rounded-2xl p-6 md:p-7 border border-white/5 hover:border-[#e7c76a]/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#e7c76a]/20 to-transparent border border-[#e7c76a]/30 text-[#e7c76a]">
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2
                      className="font-heading text-white text-lg md:text-xl mb-3"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {s.title}
                    </h2>
                    <div className="text-[#c8d0e6] text-[14.5px] leading-relaxed">{s.body}</div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
