import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props { numero?: string; client?: string; depart?: string; arrivee?: string; prix?: number | string }

const Email = ({ numero, client, depart, arrivee, prix }: Props) => (
  <LigneoEmailShell
    preview={`Devis créé${numero ? ` — ${numero}` : ''}`}
    tagline="Devis généré"
    icon="🧾"
    title="Devis créé"
    greeting="Bonjour,"
    intro="Un nouveau devis vient d'être généré et transmis au client."
    primaryCta={{ label: 'Voir le devis', href: 'https://transportsligneo.fr/admin/devis' }}
  >
    <RecapCard
      rows={[
        numero && { label: 'N° de devis', value: numero },
        client && { label: 'Client', value: client },
        depart && arrivee && { label: 'Trajet', value: `${depart} → ${arrivee}` },
        prix && { label: 'Montant TTC', value: `${prix} €` },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[ADMIN] Devis créé${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Admin — devis créé',
  previewData: { numero: 'DEV-2026-0001', client: 'Jean Dupont', depart: 'TOURS', arrivee: 'LE MANS', prix: 180 },
} satisfies TemplateEntry
