import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, Mail, Lock, Eye, Trash2, Bell, MapPin, CreditCard } from "lucide-react";

export const Route = createFileRoute("/confidentialite")({
  component: ConfidentialitePage,
  head: () => ({
    meta: [
      { title: "Politique de confidentialité · Transports Ligneo" },
      { name: "description", content: "Politique de confidentialité de l'application Transports Ligneo Driver et du site Transports Ligneo." },
      { property: "og:title", content: "Politique de confidentialité · Transports Ligneo" },
      { property: "og:description", content: "Politique de confidentialité de l'application Transports Ligneo Driver et du site Transports Ligneo." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://transportsligneo.fr/confidentialite" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/confidentialite" }],
  }),
});

const sections = [
  {
    id: "donnees",
    icon: Eye,
    title: "1. Données que nous collectons",
    body: (
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 text-[13.5px] font-bold text-white">1.1 Données de compte</h3>
          <ul className="list-disc space-y-1 pl-5 text-[#c8d0e6]">
            <li>Nom, prénom</li>
            <li>Adresse e-mail</li>
            <li>Numéro de téléphone</li>
            <li>Photo de profil (le cas échéant)</li>
            <li>Documents professionnels nécessaires à la vérification du statut de convoyeur (permis de conduire, pièce d'identité)</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-[13.5px] font-bold text-white">1.2 Données de localisation</h3>
          <p className="text-[#c8d0e6]">
            <strong className="text-white">Position GPS en temps réel</strong>, collectée uniquement pendant l'exécution active d'une mission de convoyage (du départ à la livraison du véhicule), afin de permettre le suivi de la mission par l'administrateur et le client. La localisation n'est <strong className="text-white">pas</strong> collectée en dehors des périodes de mission active.
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-[13.5px] font-bold text-white">1.3 Photos et documents de mission</h3>
          <ul className="list-disc space-y-1 pl-5 text-[#c8d0e6]">
            <li>Photos de l'état des lieux du véhicule (départ et arrivée)</li>
            <li>Signatures numériques (convoyeur et destinataire)</li>
            <li>Photo de selfie d'identification en début de mission (le cas échéant)</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-[13.5px] font-bold text-white">1.4 Données techniques</h3>
          <ul className="list-disc space-y-1 pl-5 text-[#c8d0e6]">
            <li>Identifiant de l'appareil, type d'appareil, version du système d'exploitation</li>
            <li>Journaux d'utilisation de l'application (à des fins de diagnostic et d'amélioration du service)</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-[13.5px] font-bold text-white">1.5 Données financières</h3>
          <p className="text-[#c8d0e6]">
            Coordonnées bancaires pour le versement des rémunérations, traitées par notre prestataire de paiement Stripe. Nous ne stockons pas vos données bancaires complètes sur nos serveurs.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "finalites",
    icon: MapPin,
    title: "2. Pourquoi nous collectons ces données",
    body: (
      <div className="overflow-hidden rounded-xl border border-[#7aa3ff]/15">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#3f7bff]/10 text-[#d9b54a]">
            <tr>
              <th className="px-4 py-3 font-bold">Donnée</th>
              <th className="px-4 py-3 font-bold">Finalité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#7aa3ff]/10 text-[#c8d0e6]">
            <tr>
              <td className="px-4 py-3">Compte / identité</td>
              <td className="px-4 py-3">Créer et sécuriser votre compte convoyeur, vérifier votre éligibilité</td>
            </tr>
            <tr>
              <td className="px-4 py-3">Localisation GPS</td>
              <td className="px-4 py-3">Permettre le suivi en temps réel des missions par l'administrateur et le client</td>
            </tr>
            <tr>
              <td className="px-4 py-3">Photos état des lieux</td>
              <td className="px-4 py-3">Constituer une preuve contractuelle de l'état du véhicule, protéger toutes les parties en cas de litige</td>
            </tr>
            <tr>
              <td className="px-4 py-3">Données financières</td>
              <td className="px-4 py-3">Vous verser votre rémunération</td>
            </tr>
            <tr>
              <td className="px-4 py-3">Données techniques</td>
              <td className="px-4 py-3">Assurer le bon fonctionnement, la sécurité et le diagnostic de l'application</td>
            </tr>
          </tbody>
        </table>
        <p className="border-t border-[#7aa3ff]/15 bg-[#3f7bff]/5 px-4 py-3 text-[13px] text-[#c8d0e6]">
          Nous ne collectons <strong className="text-white">aucune donnée à des fins publicitaires</strong> et ne revendons <strong className="text-white">aucune donnée personnelle</strong> à des tiers.
        </p>
      </div>
    ),
  },
  {
    id: "partage",
    icon: Shield,
    title: "3. Partage des données",
    body: (
      <div className="space-y-3 text-[#c8d0e6]">
        <p>Vos données peuvent être partagées avec :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-white">Notre prestataire d'hébergement</strong> (Supabase) — hébergement sécurisé de la base de données</li>
          <li><strong className="text-white">Notre prestataire de paiement</strong> (Stripe) — traitement des versements de rémunération</li>
          <li><strong className="text-white">Notre prestataire SMS</strong> (Twilio, si activé) — envoi de notifications par SMS</li>
          <li><strong className="text-white">Le client à l'origine de la mission</strong> — uniquement les informations strictement nécessaires à l'exécution de la mission (prénom, contact), jamais vos données bancaires ou personnelles complètes</li>
          <li><strong className="text-white">Les autorités compétentes</strong> si la loi nous y oblige (réquisition judiciaire, obligation légale)</li>
        </ul>
        <p>Nous ne partageons jamais vos données à des fins commerciales ou publicitaires avec des tiers non mentionnés ci-dessus.</p>
      </div>
    ),
  },
  {
    id: "conservation",
    icon: Lock,
    title: "4. Conservation des données",
    body: (
      <ul className="list-disc space-y-2 pl-5 text-[#c8d0e6]">
        <li>Les données de compte sont conservées tant que votre compte convoyeur est actif.</li>
        <li>Les données de mission (photos, état des lieux, signatures) sont conservées pendant une durée de <strong className="text-white">5 ans</strong> à des fins de preuve contractuelle et d'obligations légales.</li>
        <li>Les données de localisation GPS liées à une mission sont conservées pendant <strong className="text-white">12 mois</strong> puis supprimées ou anonymisées.</li>
      </ul>
    ),
  },
  {
    id: "securite",
    icon: Shield,
    title: "5. Sécurité des données",
    body: (
      <ul className="list-disc space-y-2 pl-5 text-[#c8d0e6]">
        <li>Chiffrement des données en transit (HTTPS/TLS)</li>
        <li>Accès restreint aux données selon le principe du besoin d'en connaître</li>
        <li>Hébergement sécurisé chez un prestataire certifié</li>
      </ul>
    ),
  },
  {
    id: "droits",
    icon: Eye,
    title: "6. Vos droits",
    body: (
      <div className="space-y-3 text-[#c8d0e6]">
        <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants concernant vos données personnelles :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-white">Droit d'accès</strong> : obtenir une copie des données que nous détenons sur vous</li>
          <li><strong className="text-white">Droit de rectification</strong> : corriger des données inexactes</li>
          <li><strong className="text-white">Droit à l'effacement</strong> : demander la suppression de vos données (sous réserve de nos obligations légales de conservation)</li>
          <li><strong className="text-white">Droit à la limitation du traitement</strong></li>
          <li><strong className="text-white">Droit à la portabilité</strong> de vos données</li>
          <li><strong className="text-white">Droit d'opposition</strong> au traitement de vos données</li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous à :{" "}
          <a href="mailto:contact@transportsligneo.fr" className="text-[#4f8cff] underline underline-offset-2 hover:text-white transition-colors">
            contact@transportsligneo.fr
          </a>
        </p>
        <p>
          Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés —{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-[#4f8cff] underline underline-offset-2 hover:text-white transition-colors">
            www.cnil.fr
          </a>
          ).
        </p>
      </div>
    ),
  },
  {
    id: "suppression",
    icon: Trash2,
    title: "7. Suppression de compte et de données",
    body: (
      <div className="space-y-3 text-[#c8d0e6]">
        <p>Vous pouvez demander la suppression de votre compte et de vos données associées à tout moment :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Depuis l'application : Paramètres &gt; Supprimer mon compte</li>
          <li>
            Par e-mail à :{" "}
            <a href="mailto:contact@transportsligneo.fr" className="text-[#4f8cff] underline underline-offset-2 hover:text-white transition-colors">
              contact@transportsligneo.fr
            </a>
          </li>
        </ul>
        <p>Le traitement de votre demande interviendra dans un délai maximum de 30 jours, sous réserve des données que nous sommes légalement tenus de conserver (documents contractuels, obligations comptables).</p>
      </div>
    ),
  },
  {
    id: "permissions",
    icon: Bell,
    title: "8. Permissions de l'application",
    body: (
      <div className="space-y-3 text-[#c8d0e6]">
        <p>L'application demande les autorisations suivantes sur votre appareil :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-white">Localisation (GPS)</strong> : nécessaire au suivi des missions en cours</li>
          <li><strong className="text-white">Appareil photo</strong> : nécessaire à la prise de photos pour les états des lieux</li>
          <li><strong className="text-white">Notifications</strong> : pour vous informer des nouvelles missions et mises à jour</li>
        </ul>
        <p>Vous pouvez à tout moment modifier ces autorisations dans les paramètres de votre appareil, sachant que certaines fonctionnalités de l'application pourraient ne plus fonctionner correctement sans elles.</p>
      </div>
    ),
  },
  {
    id: "modifications",
    icon: CreditCard,
    title: "9. Modifications de cette politique",
    body: (
      <p className="text-[#c8d0e6]">
        Nous pouvons modifier cette politique de confidentialité à tout moment. En cas de modification substantielle, nous vous en informerons via l'application ou par e-mail.
      </p>
    ),
  },
  {
    id: "contact",
    icon: Mail,
    title: "10. Contact",
    body: (
      <div className="space-y-2 text-[#c8d0e6]">
        <p className="font-bold text-white">Transports Ligneo</p>
        <p>Tours (37), France</p>
        <p>
          E-mail :{" "}
          <a href="mailto:contact@transportsligneo.fr" className="text-[#4f8cff] underline underline-offset-2 hover:text-white transition-colors">
            contact@transportsligneo.fr
          </a>
        </p>
        <p>
          Site web :{" "}
          <a href="https://www.transportsligneo.fr" target="_blank" rel="noopener noreferrer" className="text-[#4f8cff] underline underline-offset-2 hover:text-white transition-colors">
            www.transportsligneo.fr
          </a>
        </p>
      </div>
    ),
  },
];

function ConfidentialitePage() {
  return (
    <div className="r4-page min-h-screen">
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-28">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-[#9aa6c9] transition-colors hover:text-white"
        >
          <ArrowLeft size={16} /> Retour à l'accueil
        </Link>

        <div className="r4-eyebrow mb-5 inline-flex">
          <span className="r4-eyebrow-dot" />
          Application convoyeur
        </div>
        <h1
          className="mb-4 font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-5xl"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Politique de confidentialité
        </h1>
        <p className="mb-3 max-w-2xl text-[15.5px] leading-relaxed text-[#9aa6c9]">
          Transports Ligneo Driver — éditée par Transports Ligneo, entrepreneur individuel, immatriculée sous le SIREN 753 320 001, dont le siège est situé à Tours (37), France.
        </p>
        <p className="mb-12 text-sm text-[#9aa6c9]">
          Dernière mise à jour : 10 août 2026
        </p>

        <div className="grid gap-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <article
                key={s.id}
                id={s.id}
                className="glass-onyx rounded-2xl border border-white/5 p-6 transition-colors hover:border-[#e7c76a]/30 md:p-7"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e7c76a]/30 bg-gradient-to-br from-[#e7c76a]/20 to-transparent text-[#e7c76a]">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2
                      className="mb-4 font-heading text-lg text-white md:text-xl"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {s.title}
                    </h2>
                    <div className="text-[14.5px] leading-relaxed">{s.body}</div>
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
