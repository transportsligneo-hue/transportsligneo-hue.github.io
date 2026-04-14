import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/cgv")({
  component: CGVPage,
  head: () => ({
    meta: [
      { title: "CGV — Transports LIGNEO" },
      { name: "description", content: "Conditions generales de vente de Transports LIGNEO." },
    ],
  }),
});

function CGVPage() {
  return (
    <div className="min-h-screen section-bg py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-primary text-sm hover:underline mb-8 inline-block">&larr; Retour à l'accueil</Link>
        <h1 className="font-heading text-3xl text-primary tracking-[0.2em] uppercase mb-8">Conditions Générales de Vente</h1>
        <div className="card-premium p-8 rounded space-y-6 text-cream/70 text-sm leading-relaxed">
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Article 1 — Objet</h2>
            <p>Les présentes conditions générales de vente régissent les relations contractuelles entre Transports LIGNEO et ses clients pour l'ensemble des prestations de convoyage automobile proposées.</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Article 2 — Prestations</h2>
            <p>Transports LIGNEO propose des services de convoyage, livraison et mise à disposition de véhicules en France et en Europe. Les tarifs sont communiqués sur devis ou selon la grille tarifaire en vigueur.</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Article 3 — Tarifs et Paiement</h2>
            <p>Les tarifs s'entendent en euros TTC. Le paiement est dû à réception de la facture, sauf conditions particulières convenues. Tout retard de paiement entraîne des pénalités conformément à la législation en vigueur.</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Article 4 — Responsabilité</h2>
            <p>Transports LIGNEO s'engage à assurer le transport des véhicules avec le plus grand soin. Une assurance circulation est incluse dans chaque prestation. La responsabilité est limitée conformément aux dispositions légales applicables au transport routier.</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Article 5 — Annulation</h2>
            <p>Toute annulation doit être notifiée au moins 24 heures avant la date prévue. En cas d'annulation tardive, des frais pourront être appliqués.</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Article 6 — Litiges</h2>
            <p>En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, le tribunal compétent sera celui du siège social de Transports LIGNEO.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
