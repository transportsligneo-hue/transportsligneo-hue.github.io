import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; depart?: string; arrivee?: string; date?: string; prix?: number | string }

const Email = ({ prenom, numero, depart, arrivee, date, prix }: Props) => (
  <LigneoEmailShell
    preview={`Offre acceptée${numero ? ` — ${numero}` : ''}`}
    tagline="Offre acceptée"
    icon="✅"
    title="Votre offre a été acceptée"
    greeting={prenom ? `Félicitations ${prenom},` : 'Félicitations,'}
    intro="L'administration vient de retenir votre offre. La mission vous est officiellement attribuée."
    primaryCta={{ label: 'Voir la mission', href: 'https://transportsligneo.fr/convoyeur/missions' }}
  >
    <HighlightBox label="Statut" value="✓ Mission attribuée" tone="success" />
    <RecapCard
      rows={[
        numero && { label: 'N° de mission', value: numero },
        depart && arrivee && { label: 'Trajet', value: `${depart} → ${arrivee}` },
        date && { label: 'Date', value: date },
        prix && { label: 'Rémunération convoyeur', value: `${prix} €` },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Offre acceptée${d.numero ? ` — mission n° ${d.numero}` : ''}`,
  displayName: 'Offre acceptée (convoyeur)',
  previewData: { prenom: 'Thomas', numero: 'MIS-2026-0001', depart: 'TOURS', arrivee: 'LE MANS', date: '20/06/2026', prix: 90 },
} satisfies TemplateEntry
