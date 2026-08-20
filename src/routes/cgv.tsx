import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ScrollText } from "lucide-react";

export const Route = createFileRoute("/cgv")({
  component: CGVPage,
  head: () => ({
    meta: [
      { title: "CGV · Transports Ligneo" },
      { name: "description", content: "Conditions générales de vente Transports Ligneo : prestations de convoyage, tarifs, zone d'intervention, assurance et annulation." },
      { property: "og:title", content: "CGV · Transports Ligneo" },
      { property: "og:description", content: "Prestations de convoyage, tarifs, zone d'intervention, assurance et conditions d'annulation." },
      { property: "og:url", content: "https://transportsligneo.fr/cgv" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/cgv" }],
  }),
});

type Section = { title: string; body: React.ReactNode };

const sections: Section[] = [
  { title: "Identité de l'entreprise", body: <p>Transports Ligneo · SIREN : 753 320 001 · Siège social à Tours (37), France.</p> },
  { title: "Objet", body: <p>Les présentes Conditions Générales de Vente (CGV) définissent les modalités de prestation de services proposées par Transports Ligneo, spécialisée dans le convoyage et le transport de véhicules avec chauffeur professionnel.</p> },
  {
    title: "Prestations",
    body: (
      <>
        <p className="mb-2">Transports Ligneo propose :</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Le convoyage de véhicules (livraison simple ou livraison + restitution)</li>
          <li>La livraison de véhicules à domicile ou sur site</li>
          <li>Des prestations sur mesure selon la demande du client</li>
        </ul>
        <p className="mt-2">Les services sont réalisés par des chauffeurs professionnels.</p>
      </>
    ),
  },
  { title: "Zone d'intervention", body: <p>Les prestations sont principalement réalisées au départ de Tours et dans les départements environnants ainsi que sur toute la France selon demande.</p> },
  {
    title: "Tarifs",
    body: (
      <>
        <p className="mb-2">Les tarifs sont exprimés en euros TTC.</p>
        <p className="mb-2">Les prix incluent :</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Le carburant</li>
          <li>Les péages</li>
          <li>Les frais de déplacement du chauffeur</li>
        </ul>
        <p className="mt-2">Les tarifs livraison + restitution bénéficient d'un avantage tarifaire.</p>
        <p className="mt-2">Un ajustement peut être appliqué si la distance réelle ou les conditions diffèrent de la demande initiale.</p>
      </>
    ),
  },
  {
    title: "Réservation",
    body: (
      <>
        <p className="mb-2">Toute réservation s'effectue via le site, téléphone ou formulaire.</p>
        <p>La réservation est considérée comme validée après confirmation par Transports Ligneo et, le cas échéant, réception du paiement ou d'un acompte.</p>
      </>
    ),
  },
  {
    title: "Paiement",
    body: (
      <>
        <p className="mb-2">Le paiement peut être effectué par les moyens suivants :</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Virement bancaire</li>
          <li>Espèces</li>
          <li>Autres moyens selon accord</li>
        </ul>
        <p className="mt-2">Le paiement peut être exigé avant ou à la fin de la prestation.</p>
      </>
    ),
  },
  {
    title: "Annulation",
    body: (
      <ul className="list-disc list-inside space-y-1 ml-2">
        <li>Annulation gratuite jusqu'à 24 heures avant la prestation</li>
        <li>Entre 24h et 12h : 50% du montant</li>
        <li>Moins de 12h ou absence : 100% du montant dû</li>
      </ul>
    ),
  },
  {
    title: "Responsabilité",
    body: (
      <>
        <p className="mb-2">Le client certifie que le véhicule est en état de circuler et conforme à la réglementation.</p>
        <p className="mb-2">Un état des lieux peut être effectué avant et après la prestation.</p>
        <p className="mb-2">Transports Ligneo ne pourra être tenu responsable :</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Des pannes mécaniques</li>
          <li>Des défauts non signalés</li>
          <li>De l'usure normale du véhicule</li>
        </ul>
        <p className="mt-2">Les chauffeurs sont assurés pour la conduite du véhicule.</p>
      </>
    ),
  },
  {
    title: "Délais",
    body: (
      <>
        <p className="mb-2">Les délais de livraison sont donnés à titre indicatif.</p>
        <p>Des retards peuvent survenir en raison de facteurs indépendants (trafic, météo, incidents).</p>
      </>
    ),
  },
  { title: "Données personnelles", body: <p>Les informations collectées sont utilisées uniquement dans le cadre de la prestation et ne sont pas revendues.</p> },
  {
    title: "Litiges",
    body: (
      <>
        <p className="mb-2">Les présentes CGV sont soumises au droit français.</p>
        <p>En cas de litige, compétence est attribuée aux tribunaux du ressort du siège de l'entreprise.</p>
      </>
    ),
  },
  { title: "Avantage commercial", body: <p>Lavage extérieur offert pour toute livraison supérieure à 200 kilomètres.</p> },
];

function CGVPage() {
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
          Conditions Générales de Vente
        </h1>
        <p className="text-[#9aa6c9] text-[15.5px] leading-relaxed max-w-2xl mb-12">
          Conditions Générales de Vente — Transports Ligneo. Applicables à toute prestation de convoyage et de transport de véhicules.
        </p>

        <div className="grid gap-4">
          {sections.map((s, i) => (
            <article
              key={s.title}
              className="glass-onyx rounded-2xl p-6 md:p-7 border border-white/5 hover:border-[#e7c76a]/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#e7c76a]/20 to-transparent border border-[#e7c76a]/30 text-[#e7c76a]">
                  <ScrollText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] tracking-[0.25em] text-[#e7c76a]/80 uppercase mb-1">
                    Article {String(i + 1).padStart(2, "0")}
                  </div>
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
          ))}
        </div>
      </section>
    </div>
  );
}
