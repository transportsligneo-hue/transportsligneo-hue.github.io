import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  depart?: string
  arrivee?: string
  prix?: number | string
  dateSignature?: string
}

const Email = ({ prenom, numero, depart, arrivee, prix, dateSignature }: Props) => (
  <LigneoEmailShell
    preview="Votre mission va être planifiée."
    tagline="Devis signé"
    title="Votre devis est accepté ✓"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    primaryCta={{ label: 'Voir ma mission', href: 'https://transportsligneo.fr/dashboard-client/missions' }}
  >
    <SimpleCard
      title={[numero, prix && `${prix} €`].filter(Boolean).join(' — ')}
      subtitle={[
        dateSignature ? `Signé électroniquement le ${dateSignature}` : 'Signé électroniquement',
        depart && arrivee ? `${depart} → ${arrivee}` : null,
      ].filter(Boolean).join(' · ')}
    />
    <p style={{ fontSize: 14, lineHeight: 1.65, color: '#4b5468', margin: '0 0 16px' }}>
      Votre mission va maintenant être attribuée à l'un de nos convoyeurs. Vous recevrez une confirmation dès que ce sera fait.
    </p>
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Devis signé${d.numero ? ` — ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Devis accepté (client)',
  previewData: { prenom: 'Morgane', numero: 'DEV-TLG-2026-091', depart: 'La Riche', arrivee: 'Tours', prix: 120, dateSignature: '22/07/2026' },
} satisfies TemplateEntry
