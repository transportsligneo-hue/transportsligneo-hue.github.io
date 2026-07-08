import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, HighlightBox, RecapCard } from './_ligneo-header'

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
    preview={titre || 'Message de Transports Ligneo'}
    tagline="Message personnalisé"
    icon="✉️"
    title={titre || 'Message de Transports Ligneo'}
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={message || 'Nous vous contactons au sujet de votre espace Transports Ligneo.'}
    primaryCta={ctaUrl ? { label: ctaLabel || 'Ouvrir mon espace', href: ctaUrl } : null}
  >
    {reference ? <RecapCard title="Référence" rows={[{ label: 'Dossier', value: reference }]} /> : null}
    <HighlightBox
      tone="navy"
      label="Information"
      value="Votre équipe Transports Ligneo reste disponible pour toute précision."
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
    ctaLabel: 'Ouvrir mon espace',
    ctaUrl: 'https://transportsligneo.fr/login',
    reference: 'Dossier convoyeur',
  },
} satisfies TemplateEntry