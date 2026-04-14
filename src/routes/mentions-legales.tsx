import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/mentions-legales")({
  component: MentionsLegalesPage,
  head: () => ({
    meta: [
      { title: "Mentions Legales — Transports LIGNEO" },
      { name: "description", content: "Mentions legales du site Transports LIGNEO." },
    ],
  }),
});

function MentionsLegalesPage() {
  return (
    <div className="min-h-screen section-bg py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-primary text-sm hover:underline mb-8 inline-block">&larr; Retour à l'accueil</Link>
        <h1 className="font-heading text-3xl text-primary tracking-[0.2em] uppercase mb-8">Mentions Légales</h1>
        <div className="card-premium p-8 rounded space-y-6 text-cream/70 text-sm leading-relaxed">
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Éditeur du site</h2>
            <p>Transports LIGNEO<br />Siège social : Tours (37), France<br />Téléphone : 07 82 45 61 81<br />Email : contact@transportsligneo.fr<br />Site : www.transportsligneo.fr</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Hébergement</h2>
            <p>Ce site est hébergé par Lovable (lovable.dev).</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Propriété intellectuelle</h2>
            <p>L'ensemble des contenus (textes, images, logos) présents sur ce site sont la propriété exclusive de Transports LIGNEO, sauf mention contraire. Toute reproduction est interdite sans autorisation préalable.</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Responsabilité</h2>
            <p>Transports LIGNEO s'efforce de fournir des informations exactes et à jour. Toutefois, la société ne saurait être tenue responsable des erreurs ou omissions.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
