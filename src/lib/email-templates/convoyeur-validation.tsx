import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, HighlightBox } from './_ligneo-header'

interface Props { prenom?: string }

const Email = ({ prenom }: Props) => (
  <LigneoEmailShell
    preview="Votre compte convoyeur est validé"
    tagline="Compte validé"
    icon="✅"
    title="Compte convoyeur validé"
    greeting={prenom ? `Félicitations ${prenom},` : 'Félicitations,'}
    intro="Votre compte convoyeur est désormais validé. Vous pouvez consulter les missions disponibles et postuler à celles qui vous intéressent depuis votre espace personnel."
    primaryCta={{ label: 'Voir les missions disponibles', href: 'https://transportsligneo.fr/convoyeur/catalogue' }}
    secondaryCta={{ label: 'Compléter mes disponibilités', href: 'https://transportsligneo.fr/convoyeur/disponibilites' }}
  >
    <HighlightBox
      label="Bienvenue dans le réseau"
      value="✓ Accès complet à la plateforme Ligneo"
      tone="success"
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: 'Votre compte convoyeur est validé — Transports Ligneo',
  displayName: 'Convoyeur — validation',
  previewData: { prenom: 'Thomas' },
} satisfies TemplateEntry
