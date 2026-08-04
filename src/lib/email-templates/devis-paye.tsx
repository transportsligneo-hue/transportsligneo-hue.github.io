import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, AmountRow, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  depart?: string
  arrivee?: string
  prix?: number | string
  facture?: string
}

const Email = ({ prenom, numero, depart, arrivee, prix, facture }: Props) => (
  <LigneoEmailShell
    preview="Merci, votre paiement est confirmé."
    tagline="Paiement reçu"
    title="Merci pour votre paiement"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    primaryCta={{ label: 'Voir mon reçu', href: 'https://transportsligneo.fr/dashboard-client/documents' }}
  >
    {prix ? <AmountRow label="Montant réglé" amount={`${prix} €`} /> : null}
    {(facture || numero || (depart && arrivee)) ? (
      <SimpleCard
        title={facture || numero}
        subtitle={[depart && arrivee ? `${depart} → ${arrivee}` : null, 'Carte bancaire'].filter(Boolean).join(' · ')}
      />
    ) : null}
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Paiement reçu${d.numero ? ` — ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Devis payé (client)',
  previewData: { prenom: 'Morgane', numero: 'PAY-TLG-2026-091', facture: 'FAC-TLG-2026-114', depart: 'La Riche', arrivee: 'Tours', prix: 120 },
} satisfies TemplateEntry
