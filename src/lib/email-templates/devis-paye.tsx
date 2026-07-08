import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

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
    preview={`Paiement reçu — ${numero ?? ''}`}
    tagline="Paiement confirmé"
    icon="💳"
    title="Paiement reçu"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Nous vous confirmons la bonne réception de votre paiement. Votre mission est désormais programmée."
    primaryCta={{ label: 'Voir la facture', href: 'https://transportsligneo.fr/dashboard-client/documents' }}
  >
    {prix ? <HighlightBox label="Paiement confirmé" value={`${prix} €`} tone="success" /> : null}
    <RecapCard
      rows={[
        facture && { label: 'N° de facture', value: facture },
        numero && { label: 'Référence paiement', value: numero },
        depart && arrivee && { label: 'Trajet', value: `${depart} → ${arrivee}` },
        { label: 'Mode de paiement', value: 'Carte bancaire' },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Paiement reçu${d.numero ? ` — ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Devis payé (client)',
  previewData: { prenom: 'Jean', numero: 'PAY-2026-0001', facture: 'FAC-2026-0001', depart: 'TOURS', arrivee: 'LE MANS', prix: 180 },
} satisfies TemplateEntry
