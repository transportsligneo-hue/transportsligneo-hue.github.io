import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  titre?: string
  message?: string
  ctaLabel?: string
  ctaUrl?: string
  reference?: string
}

const Email = ({ prenom, titre, message, ctaLabel, ctaUrl, reference }: Props) => (
  <LigneoEmailShell
    preview="Vous avez reçu un message de notre équipe."
    tagline="Message de l'équipe"
    title={titre || 'Vous avez un nouveau message'}
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    primaryCta={{ label: ctaLabel || 'Lire le message', href: ctaUrl || 'https://transportsligneo.fr/login' }}
  >
    <SimpleCard
      title={reference || undefined}
      subtitle={message || 'Notre équipe vous a envoyé un message concernant votre compte ou une mission en cours.'}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (data) => data.titre || 'Message de Transports Ligneo',
  displayName: 'Message manuel',
  previewData: {
    prenom: 'Thomas',
    titre: 'Information concernant votre dossier',
    message: 'Votre dossier a été mis à jour. Merci de consulter votre espace.',
    ctaLabel: 'Lire le message',
    ctaUrl: 'https://transportsligneo.fr/login',
    reference: 'Dossier convoyeur',
  },
} satisfies TemplateEntry
