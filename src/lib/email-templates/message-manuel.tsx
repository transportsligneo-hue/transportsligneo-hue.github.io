import * as React from 'react'
import { Img, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  subject?: string
  titre?: string
  message?: string
  ctaLabel?: string
  ctaUrl?: string
  reference?: string
  visualUrl?: string
  preheader?: string
}

const Email = ({ prenom, titre, message, ctaLabel, ctaUrl, reference, visualUrl, preheader }: Props) => (
  <LigneoEmailShell
    preview={preheader || 'Vous avez reçu un message de notre équipe.'}
    tagline="Message de l'équipe"
    title={titre || 'Vous avez un nouveau message'}
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    primaryCta={ctaLabel && ctaUrl ? { label: ctaLabel, href: ctaUrl } : null}
  >
    {visualUrl ? (
      <Section style={{ margin: '0 0 20px' }}>
        <Img
          src={visualUrl}
          alt="Illustration du message"
          width="536"
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '8px' }}
        />
      </Section>
    ) : null}
    <SimpleCard
      title={reference || undefined}
      subtitle={message || 'Notre équipe vous a envoyé un message concernant votre compte ou une mission en cours.'}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (data) => data.subject || data.titre || 'Message de Transports Ligneo',
  displayName: 'Message manuel',
  previewData: {
    prenom: 'Thomas',
    subject: 'Information concernant votre dossier',
    titre: 'Information concernant votre dossier',
    message: 'Votre dossier a été mis à jour. Merci de consulter votre espace.',
    ctaLabel: 'Lire le message',
    ctaUrl: 'https://transportsligneo.fr/login',
    reference: 'Dossier convoyeur',
  },
} satisfies TemplateEntry
