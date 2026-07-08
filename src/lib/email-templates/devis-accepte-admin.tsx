import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

interface Props { numero?: string; client?: string; prix?: number | string }

const Email = ({ numero, client, prix }: Props) => (
  <LigneoEmailShell
    preview={`Devis signé par le client${numero ? ` — ${numero}` : ''}`}
    tagline="Devis signé"
    icon="✍"
    title="Devis signé par le client"
    greeting="Bonjour,"
    intro="Un client vient de signer son devis. Vous pouvez lancer la création de la mission."
    primaryCta={{ label: 'Créer la mission', href: 'https://transportsligneo.fr/admin/devis' }}
  >
    <HighlightBox label="Statut" value="✓ Signature électronique validée" tone="success" />
    <RecapCard
      rows={[
        numero && { label: 'N° de devis', value: numero },
        client && { label: 'Client', value: client },
        prix && { label: 'Montant TTC', value: `${prix} €` },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[ADMIN] Devis signé${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Admin — devis accepté',
  previewData: { numero: 'DEV-2026-0001', client: 'Jean Dupont', prix: 180 },
} satisfies TemplateEntry
