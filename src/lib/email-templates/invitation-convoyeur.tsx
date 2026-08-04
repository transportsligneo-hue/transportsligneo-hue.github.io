import * as React from 'react'
import { HighlightBox, InfoParagraph, LigneoEmailShell, RecapCard, SimpleCard } from './_ligneo-header'
import type { TemplateEntry } from './registry'

interface InvitationConvoyeurProps {
  prenom?: string | null
  nom?: string | null
  inviteUrl: string
  expiresLabel?: string | null
}

export const InvitationConvoyeurEmail = ({ prenom, nom, inviteUrl, expiresLabel }: InvitationConvoyeurProps) => (
  <LigneoEmailShell
    preview="Votre invitation personnelle pour rejoindre le réseau de convoyeurs Transports Ligneo."
    tagline="Direction des opérations — Réseau convoyeurs"
    title="Invitation à rejoindre Transports Ligneo"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={nom
      ? `À l'attention de ${prenom ? `${prenom} ` : ''}${nom}. Notre équipe a le plaisir de vous inviter à intégrer notre réseau national de convoyeurs professionnels.`
      : "Notre équipe a le plaisir de vous inviter à intégrer notre réseau national de convoyeurs professionnels."}
    primaryCta={{ label: 'Activer mon espace convoyeur', href: inviteUrl }}
    footnote={
      expiresLabel
        ? `Ce lien d'activation est strictement personnel et valable jusqu'au ${expiresLabel}. Pour votre sécurité, ne le transférez pas.`
        : "Ce lien d'activation est strictement personnel et valable 14 jours. Pour votre sécurité, ne le transférez pas."
    }
    signature="Bien cordialement,\nL'équipe Réseau & Opérations\nTransports Ligneo"
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
      ]}
    />
    <HighlightBox
      label="Une équipe dédiée à vos côtés"
      value="Un accompagnement humain, du dossier à la première mission"
      meta="Après validation, vous accéderez au catalogue de missions et au suivi opérationnel depuis votre espace convoyeur."
      tone="navy"
    />
    <SimpleCard
      title="Besoin d'assistance ?"
      subtitle="Notre équipe Réseau & Opérations est disponible au 07 82 45 61 81 ou à contact@transportsligneo.fr pour vous accompagner."
    />
  </LigneoEmailShell>
)

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
  },
} satisfies TemplateEntry

export default InvitationConvoyeurEmail
