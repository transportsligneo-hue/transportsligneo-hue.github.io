import * as React from 'react'
import { HighlightBox, InfoParagraph, LigneoEmailShell, RecapCard, SimpleCard } from './_ligneo-header'
import type { TemplateEntry } from './registry'

interface InvitationConvoyeurProps {
  prenom?: string | null
  nom?: string | null
  inviteUrl: string
  expiresLabel?: string | null
  catalogueUrl?: string | null
  formationStatut?: 'a_demarrer' | 'en_cours' | 'validee' | null
}

const CATALOGUE_URL_DEFAULT = 'https://transportsligneo.fr/convoyeur/catalogue'

const STATUT_LABEL: Record<'a_demarrer' | 'en_cours' | 'validee', { label: string; meta: string }> = {
  a_demarrer: {
    label: 'Formation à démarrer',
    meta: "Le catalogue de missions reste verrouillé tant que la formation Académie Ligneo n'est pas validée.",
  },
  en_cours: {
    label: 'Formation en cours',
    meta: "Terminez vos modules pour débloquer l'accès au catalogue de missions.",
  },
  validee: {
    label: 'Formation validée',
    meta: 'Le catalogue de missions est désormais accessible depuis votre espace convoyeur.',
  },
}

export const InvitationConvoyeurEmail = ({
  prenom,
  nom,
  inviteUrl,
  expiresLabel,
  catalogueUrl,
  formationStatut,
}: InvitationConvoyeurProps) => {
  const statut = STATUT_LABEL[formationStatut ?? 'a_demarrer']
  return (
    <LigneoEmailShell
      preview="Votre invitation personnelle pour rejoindre le réseau de convoyeurs Transports Ligneo."
      tagline="Direction des opérations — Réseau convoyeurs"
      title="Invitation à rejoindre Transports Ligneo"
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      intro={nom
        ? `À l'attention de ${prenom ? `${prenom} ` : ''}${nom}. Notre équipe a le plaisir de vous inviter à intégrer notre réseau national de convoyeurs professionnels.`
        : "Notre équipe a le plaisir de vous inviter à intégrer notre réseau national de convoyeurs professionnels."}
      primaryCta={{ label: 'Activer mon espace convoyeur', href: inviteUrl }}
      secondaryCta={{
        label: 'Accéder au catalogue des missions',
        href: catalogueUrl || CATALOGUE_URL_DEFAULT,
      }}
      footnote={
        expiresLabel
          ? `Ce lien d'activation est strictement personnel et valable jusqu'au ${expiresLabel}. Pour votre sécurité, ne le transférez pas. L'accès au catalogue des missions s'ouvre une fois la formation Académie Ligneo validée.`
          : "Ce lien d'activation est strictement personnel et valable 7 jours. Pour votre sécurité, ne le transférez pas. L'accès au catalogue des missions s'ouvre une fois la formation Académie Ligneo validée."
      }
      signature={"Bien cordialement,\nL'équipe Réseau & Opérations\nTransports Ligneo"}
    >
      <InfoParagraph>
        Votre parcours d'intégration vous permet de créer vos identifiants, compléter votre profil
        professionnel et transmettre vos justificatifs dans un environnement sécurisé.
      </InfoParagraph>
      <RecapCard
        title="Votre parcours d'intégration"
        rows={[
          { label: '1. Compte', value: 'Créez vos accès personnels' },
          { label: '2. Dossier', value: 'Complétez votre profil et vos disponibilités' },
          { label: '3. Documents', value: 'Déposez vos justificatifs professionnels' },
          { label: '4. Validation', value: 'Notre équipe étudie et active votre dossier' },
          { label: '5. Formation', value: 'Suivez la formation Académie Ligneo (obligatoire)' },
          { label: '6. Missions', value: 'Accédez au catalogue de missions' },
        ]}
      />
      <HighlightBox
        label="Formation Académie Ligneo — étape obligatoire"
        value="Une courte formation en ligne avant l'accès au catalogue de missions"
        meta="Une fois votre dossier validé, vous suivez depuis votre espace convoyeur la formation Académie Ligneo (procédures d'état des lieux, prise en charge, livraison et qualité de service). Elle se termine par un examen ; sa réussite délivre votre attestation et débloque immédiatement l'accès au catalogue de missions et au suivi opérationnel."
        tone="navy"
      />
      <HighlightBox
        label="Statut de votre formation"
        value={statut.label}
        meta={statut.meta}
        tone="gold"
      />
      <SimpleCard
        title="Besoin d'assistance ?"
        subtitle="Notre équipe Réseau & Opérations est disponible au 07 82 45 61 81 ou à contact@transportsligneo.fr pour vous accompagner."
      />
    </LigneoEmailShell>
  )
}

export const template = {
  component: InvitationConvoyeurEmail,
  subject: (data: Record<string, unknown>) => data.prenom
    ? `${String(data.prenom)}, votre invitation Transports Ligneo`
    : 'Votre invitation à rejoindre Transports Ligneo',
  displayName: 'Convoyeur — invitation au réseau',
  previewData: {
    prenom: 'Jean',
    nom: 'Martin',
    inviteUrl: 'https://transportsligneo.fr/invitation-convoyeur/demo-token',
    expiresLabel: '18/08/2026',
    catalogueUrl: CATALOGUE_URL_DEFAULT,
    formationStatut: 'a_demarrer' as const,
  },
} satisfies TemplateEntry

export default InvitationConvoyeurEmail
