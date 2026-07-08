import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

interface Props {
  numero?: string
  societe?: string
  contact?: string
  email?: string
  montant?: number | string
  depart?: string
  arrivee?: string
  date?: string
}

const Email = ({ numero, societe, contact, email, montant, depart, arrivee, date }: Props) => (
  <LigneoEmailShell
    preview={`Paiement B2B reçu${numero ? ` — ${numero}` : ''}`}
    tagline="Paiement B2B"
    icon="💼"
    title="Paiement B2B reçu"
    greeting="Bonjour,"
    intro="Un client professionnel vient de finaliser un paiement pour une prestation de convoyage."
    primaryCta={{ label: 'Voir la commande', href: 'https://transportsligneo.fr/admin/b2b-dispatch' }}
  >
    {montant ? <HighlightBox label="Montant TTC" value={`${montant} €`} tone="gold" /> : null}
    <RecapCard
      title="Détails du paiement"
      rows={[
        numero && { label: 'Référence', value: numero },
        societe && { label: 'Société', value: societe },
        contact && { label: 'Contact', value: contact },
        email && { label: 'Email', value: email },
        depart && arrivee && { label: 'Trajet', value: `${depart} → ${arrivee}` },
        date && { label: 'Date souhaitée', value: date },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[ADMIN B2B] Paiement reçu${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Admin — paiement B2B',
  previewData: {
    numero: 'B2B-2026-0001', societe: 'ACME SAS', contact: 'Jean Dupont', email: 'jean@acme.com',
    montant: 240, depart: 'TOURS', arrivee: 'PARIS', date: '25/06/2026',
  },
} satisfies TemplateEntry
