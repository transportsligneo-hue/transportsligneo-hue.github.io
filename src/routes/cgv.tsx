import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/cgv")({
  component: CGVPage,
  head: () => ({
    meta: [
      { title: "CGV — Transports LIGNEO" },
      { name: "description", content: "Conditions générales de vente de Transports LIGNEO." },
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
          <p className="font-heading text-primary text-base uppercase tracking-wide">Conditions Générales de Vente – Transports Ligneo</p>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Objet</h2>
            <p>Les présentes Conditions Générales de Vente (CGV) définissent les modalités de prestation de services proposées par Transports Ligneo, spécialisée dans le convoyage et le transport de véhicules avec chauffeur professionnel.</p>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Prestations</h2>
            <p className="mb-2">Transports Ligneo propose :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Le convoyage de véhicules (aller simple ou aller-retour)</li>
              <li>La livraison de véhicules à domicile ou sur site</li>
              <li>Des prestations sur mesure selon la demande du client</li>
            </ul>
            <p className="mt-2">Les services sont réalisés par des chauffeurs professionnels.</p>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Zone d'intervention</h2>
            <p>Les prestations sont principalement réalisées au départ de Tours et dans les départements environnants ainsi que sur toute la France selon demande.</p>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Tarifs</h2>
            <p className="mb-2">Les tarifs sont exprimés en euros TTC.</p>
            <p className="mb-2">Les prix incluent :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Le carburant</li>
              <li>Les péages</li>
              <li>Les frais de déplacement du chauffeur</li>
            </ul>
            <p className="mt-2">Les tarifs aller-retour bénéficient d'un avantage tarifaire.</p>
            <p className="mt-2">Un ajustement peut être appliqué si la distance réelle ou les conditions diffèrent de la demande initiale.</p>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Réservation</h2>
            <p className="mb-2">Toute réservation s'effectue via le site, téléphone ou formulaire.</p>
            <p>La réservation est considérée comme validée après confirmation par Transports Ligneo et, le cas échéant, réception du paiement ou d'un acompte.</p>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Paiement</h2>
            <p className="mb-2">Le paiement peut être effectué par les moyens suivants :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Virement bancaire</li>
              <li>Espèces</li>
              <li>Autres moyens selon accord</li>
            </ul>
            <p className="mt-2">Le paiement peut être exigé avant ou à la fin de la prestation.</p>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Annulation</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Annulation gratuite jusqu'à 24 heures avant la prestation</li>
              <li>Entre 24h et 12h : 50% du montant</li>
              <li>Moins de 12h ou absence : 100% du montant dû</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Responsabilité</h2>
            <p className="mb-2">Le client certifie que le véhicule est en état de circuler et conforme à la réglementation.</p>
            <p className="mb-2">Un état des lieux peut être effectué avant et après la prestation.</p>
            <p className="mb-2">Transports Ligneo ne pourra être tenu responsable :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Des pannes mécaniques</li>
              <li>Des défauts non signalés</li>
              <li>De l'usure normale du véhicule</li>
            </ul>
            <p className="mt-2">Les chauffeurs sont assurés pour la conduite du véhicule.</p>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Délais</h2>
            <p className="mb-2">Les délais de livraison sont donnés à titre indicatif.</p>
            <p>Des retards peuvent survenir en raison de facteurs indépendants (trafic, météo, incidents).</p>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Données personnelles</h2>
            <p>Les informations collectées sont utilisées uniquement dans le cadre de la prestation et ne sont pas revendues.</p>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Litiges</h2>
            <p className="mb-2">Les présentes CGV sont soumises au droit français.</p>
            <p>En cas de litige, compétence est attribuée aux tribunaux du ressort du siège de l'entreprise.</p>
          </section>

          <section>
            <h2 className="font-heading text-primary text-lg mb-3">Avantage commercial</h2>
            <p>Lavage extérieur offert pour toute livraison supérieure à 200 kilomètres.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
