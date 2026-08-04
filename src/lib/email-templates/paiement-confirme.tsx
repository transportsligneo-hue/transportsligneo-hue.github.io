import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; montant?: number | string; date?: string }

const Email = ({ prenom, numero, montant, date }: Props) => (
  <LigneoEmailShell
    preview="Votre transaction a bien été validée."
    tagline="Confirmation de paiement"
    title="Paiement confirmé"
    greeting={prenom ? `Merci ${prenom},` : 'Merci,'}
    primaryCta={{ label: 'Accéder à mon espace', href: 'https://transportsligneo.fr/dashboard-client' }}
  >
    <SimpleCard
      title="Transaction validée"
      subtitle={[montant ? `${montant} €` : null, date, numero ? `Réf. ${numero}` : null].filter(Boolean).join(' · ')}
    />
    <p style={{ fontSize: 14, lineHeight: 1.65, color: '#4b5468', margin: '0 0 16px' }}>
      Merci, tout est en ordre de notre côté.
    </p>
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Paiement confirmé${d.numero ? ` — n° ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Paiement confirmé',
  previewData: { prenom: 'Morgane', numero: 'FAC-TLG-2026-114', montant: 120, date: '22/07/2026' },
} satisfies TemplateEntry
