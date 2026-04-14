import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/confidentialite")({
  component: ConfidentialitePage,
  head: () => ({
    meta: [
      { title: "Politique de Confidentialite — Transports LIGNEO" },
      { name: "description", content: "Politique de confidentialite de Transports LIGNEO." },
    ],
  }),
});

function ConfidentialitePage() {
  return (
    <div className="min-h-screen section-bg py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-primary text-sm hover:underline mb-8 inline-block">&larr; Retour à l'accueil</Link>
        <h1 className="font-heading text-3xl text-primary tracking-[0.2em] uppercase mb-8">Politique de Confidentialité</h1>
        <div className="card-premium p-8 rounded space-y-6 text-cream/70 text-sm leading-relaxed">
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Collecte des données</h2>
            <p>Les données personnelles collectées via les formulaires de contact et de devis (nom, email, téléphone, adresse) sont utilisées uniquement pour traiter vos demandes et vous fournir nos services de convoyage.</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Utilisation des données</h2>
            <p>Vos données ne sont jamais vendues ni partagées avec des tiers à des fins commerciales. Elles sont conservées uniquement le temps nécessaire au traitement de votre demande.</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Vos droits</h2>
            <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous à contact@transportsligneo.fr.</p>
          </section>
          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Cookies</h2>
            <p>Ce site n'utilise pas de cookies de suivi ni de publicité. Seuls des cookies techniques essentiels au fonctionnement du site peuvent être utilisés.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
