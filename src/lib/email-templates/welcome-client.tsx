import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell } from './_ligneo-header'

interface Props { prenom?: string }

const Email = ({ prenom }: Props) => (
  <LigneoEmailShell
    preview="Bienvenue chez Transports Ligneo"
    tagline="Bienvenue"
    icon="👋"
    title="Bienvenue chez Transports Ligneo"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Votre compte client est activé. Vous pouvez dès à présent réserver un convoyage automobile, suivre vos missions en temps réel et retrouver tous vos documents depuis votre espace personnel."
    primaryCta={{ label: 'Accéder à mon espace', href: 'https://transportsligneo.fr/dashboard-client' }}
    secondaryCta={{ label: 'Nouvelle réservation', href: 'https://transportsligneo.fr/reserver' }}
  />
)

export const template = {
  component: Email,
  subject: 'Bienvenue chez Transports Ligneo',
  displayName: 'Bienvenue (client)',
  previewData: { prenom: 'Jean' },
} satisfies TemplateEntry
