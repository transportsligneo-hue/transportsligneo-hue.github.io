import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard, RecapCard } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; trackingCode?: string; convoyeur?: string; heureDepart?: string; eta?: string; depart?: string; arrivee?: string }

const Email = ({ prenom, numero, trackingCode, convoyeur, heureDepart, eta, depart, arrivee }: Props) => (
  <LigneoEmailShell
    preview="Le convoyeur est en route."
    tagline="En cours"
    title="Votre véhicule est en route 🚗"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    primaryCta={{ label: 'Suivre en direct', href: 'https://transportsligneo.fr/suivi' }}
  >
    <SimpleCard
      title={depart && arrivee ? `${depart} → ${arrivee}` : numero}
      subtitle={[
        heureDepart ? `Départ confirmé à ${heureDepart}` : 'Départ confirmé',
        convoyeur,
        eta ? `Arrivée estimée ${eta}` : null,
      ].filter(Boolean).join(' · ')}
    />
    {(numero || trackingCode) ? (
      <RecapCard
        rows={[
          numero && { label: 'Numéro de mission', value: numero },
          trackingCode && { label: 'Code confidentiel', value: trackingCode },
        ].filter(Boolean) as any}
      />
    ) : null}
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Départ effectué${d.numero ? ` — ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Mission démarrée (client)',
  previewData: { prenom: 'Morgane', numero: 'MIS-TLG-2026-114', trackingCode: 'A7K9P2', convoyeur: 'Olivier G.', heureDepart: '10:04', eta: '14:20', depart: 'La Riche', arrivee: 'Tours' },
} satisfies TemplateEntry

