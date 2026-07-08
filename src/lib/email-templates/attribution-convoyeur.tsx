import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; convoyeur?: string; date?: string }

const Email = ({ prenom, numero, convoyeur, date }: Props) => (
  <LigneoEmailShell
    preview={`Convoyeur attribué${numero ? ` — ${numero}` : ''}`}
    tagline="Convoyeur attribué"
    icon="👤"
    title="Convoyeur attribué"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Un convoyeur professionnel a été affecté à votre mission. Vous pouvez suivre son intervention depuis votre espace client."
    primaryCta={{ label: 'Voir la mission', href: 'https://transportsligneo.fr/dashboard-client/missions' }}
  >
    <RecapCard
      rows={[
        convoyeur && { label: 'Convoyeur', value: convoyeur },
        numero && { label: 'N° de mission', value: numero },
        date && { label: 'Date prévue', value: date },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Convoyeur attribué${d.numero ? ` — mission n° ${d.numero}` : ''}`,
  displayName: 'Attribution convoyeur',
  previewData: { prenom: 'Jean', numero: 'MIS-2026-0001', convoyeur: 'Thomas D.', date: '20/06/2026' },
} satisfies TemplateEntry
