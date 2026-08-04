import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; convoyeur?: string; date?: string }

const Email = ({ prenom, numero, convoyeur, date }: Props) => (
  <LigneoEmailShell
    preview={convoyeur ? `${convoyeur} prend en charge votre mission.` : 'Votre convoyeur est désigné.'}
    tagline="Convoyeur attribué"
    title="Votre convoyeur est désigné"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    primaryCta={{ label: 'Suivre ma mission', href: 'https://transportsligneo.fr/dashboard-client/missions' }}
  >
    <SimpleCard
      title={convoyeur || 'Convoyeur vérifié'}
      subtitle={['Convoyeur vérifié', numero ? `Mission ${numero}` : null, date].filter(Boolean).join(' · ')}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Convoyeur attribué${d.numero ? ` — mission n° ${d.numero}` : ''}`,
  displayName: 'Attribution convoyeur',
  previewData: { prenom: 'Morgane', numero: 'MIS-TLG-2026-114', convoyeur: 'Olivier G.', date: '15/08/2026' },
} satisfies TemplateEntry
