import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  email?: string
  date?: string
  source?: string
}

const Email = ({ email, date, source }: Props) => (
  <LigneoEmailShell
    preview={`Nouvelle inscription liste d'attente${email ? ` — ${email}` : ''}`}
    tagline="Nouvelle inscription"
    icon="📥"
    title="Nouveau candidat convoyeur"
    greeting="Bonjour,"
    intro="Une nouvelle personne vient de laisser son email sur la page « Devenir convoyeur »."
    primaryCta={{ label: 'Voir les inscrits', href: 'https://transportsligneo.fr/admin/marketing' }}
  >
    <RecapCard
      title="Détails de l’inscription"
      rows={[
        email && { label: 'Email', value: email },
        date && { label: 'Date', value: date },
        source && { label: 'Origine', value: source },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[ADMIN] Liste d’attente convoyeur${d.email ? ` — ${d.email}` : ''}`,
  displayName: 'Admin — liste d’attente convoyeur',
  previewData: { email: 'candidat@example.com', date: '20/08/2026 01:30', source: 'Page Devenir convoyeur' },
} satisfies TemplateEntry
