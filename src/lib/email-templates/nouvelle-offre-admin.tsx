import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  numero?: string
  convoyeur?: string
  depart?: string
  arrivee?: string
  prixInitial?: number | string
  prixPropose?: number | string
  message?: string
}

const Email = ({ numero, convoyeur, depart, arrivee, prixInitial, prixPropose, message }: Props) => (
  <LigneoEmailShell
    preview={`Nouvelle offre convoyeur${numero ? ` — ${numero}` : ''}`}
    tagline="Action requise"
    icon="📥"
    title="Nouvelle offre convoyeur"
    greeting="Bonjour,"
    intro="Un convoyeur vient de proposer une offre sur une mission du catalogue. Cette proposition attend votre validation."
    primaryCta={{ label: 'Traiter la candidature', href: 'https://transportsligneo.fr/admin/candidatures' }}
  >
    <RecapCard
      rows={[
        numero && { label: 'N° de mission', value: numero },
        convoyeur && { label: 'Convoyeur', value: convoyeur },
        depart && arrivee && { label: 'Trajet', value: `${depart} → ${arrivee}` },
        prixInitial && { label: 'Prix initial', value: `${prixInitial} €` },
        prixPropose && { label: 'Prix proposé', value: `${prixPropose} €` },
        message && { label: 'Message', value: message },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[ADMIN] Nouvelle offre${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Admin — nouvelle offre',
  previewData: {
    numero: 'MIS-2026-0001', convoyeur: 'Thomas D.', depart: 'TOURS', arrivee: 'LE MANS',
    prixInitial: 120, prixPropose: 130, message: 'Je peux partir dès demain matin.',
  },
} satisfies TemplateEntry
