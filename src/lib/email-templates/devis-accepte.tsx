import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, HighlightBox, RecapCard } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  depart?: string
  arrivee?: string
  prix?: number | string
}

const Email = ({ prenom, numero, depart, arrivee, prix }: Props) => (
  <LigneoEmailShell
    preview={`Devis signé — ${numero ?? ''}`}
    tagline="Signature confirmée"
    icon="✍"
    title="Devis signé"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Votre devis a été signé électroniquement. Merci pour votre confiance."
    primaryCta={{ label: 'Voir ma mission', href: 'https://transportsligneo.fr/dashboard-client/missions' }}
  >
    <HighlightBox
      label="Devis signé avec succès"
      value="✓ Votre mission entre désormais en préparation."
      tone="success"
    />
    {(numero || depart || arrivee || prix) && (
      <RecapCard
        rows={[
          numero && { label: 'Référence', value: numero },
          depart && arrivee && { label: 'Trajet', value: `${depart} → ${arrivee}` },
          prix && { label: 'Montant TTC', value: `${prix} €` },
        ].filter(Boolean) as any}
      />
    )}
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Devis signé${d.numero ? ` — ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Devis accepté (client)',
  previewData: { prenom: 'Jean', numero: 'DEV-2026-0001', depart: 'TOURS (37)', arrivee: 'LE MANS (72)', prix: 180 },
} satisfies TemplateEntry
