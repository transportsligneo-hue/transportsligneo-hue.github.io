import * as React from 'react'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'
import type { TemplateEntry } from './registry'

interface InvitationConvoyeurProps {
  prenom?: string | null
  nom?: string | null
  inviteUrl: string
  expiresLabel?: string | null
}

export const InvitationConvoyeurEmail = ({ prenom, inviteUrl, expiresLabel }: InvitationConvoyeurProps) => (
  <LigneoEmailShell
    preview="Créez votre compte convoyeur Transports Ligneo."
    tagline="Invitation convoyeur"
    title="Rejoignez Transports Ligneo"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="L'équipe Transports Ligneo vous invite à rejoindre sa communauté de convoyeurs. Créez votre compte en quelques secondes : votre adresse email est déjà pré-remplie, il ne vous reste qu'à choisir votre mot de passe."
    primaryCta={{ label: 'Créer mon compte convoyeur', href: inviteUrl }}
    footnote={
      expiresLabel
        ? `Ce lien personnel expire le ${expiresLabel}. Si vous n'êtes pas concerné(e), ignorez simplement cet email.`
        : "Ce lien personnel est valable 14 jours. Si vous n'êtes pas concerné(e), ignorez simplement cet email."
    }
  >
    <SimpleCard
      title="Ce qui vous attend"
      subtitle="Missions de convoyage partout en France, suivi digitalisé, états des lieux photo et paiements sécurisés."
    />
  </LigneoEmailShell>
)

export const template = {
  component: InvitationConvoyeurEmail,
  subject: 'Votre invitation convoyeur — Transports Ligneo',
  displayName: 'Invitation convoyeur (admin)',
  previewData: {
    prenom: 'Jean',
    inviteUrl: 'https://transportsligneo.fr/invitation-convoyeur/demo-token',
    expiresLabel: '18/08/2026',
  },
} satisfies TemplateEntry

export default InvitationConvoyeurEmail
