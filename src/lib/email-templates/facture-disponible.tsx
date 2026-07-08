import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; montant?: number | string; echeance?: string }

const Email = ({ prenom, numero, montant, echeance }: Props) => (
  <LigneoEmailShell
    preview="Votre facture est disponible"
    tagline="Facture disponible"
    icon="🧾"
    title="Facture disponible"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Votre facture est disponible dans votre espace client."
    primaryCta={{ label: 'Télécharger la facture', href: 'https://transportsligneo.fr/dashboard-client/documents' }}
  >
    {montant ? <HighlightBox label="Montant TTC" value={`${montant} €`} tone="gold" /> : null}
    <RecapCard
      rows={[
        numero && { label: 'N° de facture', value: numero },
        echeance && { label: 'Échéance', value: echeance },
        { label: 'TVA', value: 'Non applicable, art. 293 B du CGI' },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Facture${d.numero ? ` n° ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Facture disponible',
  previewData: { prenom: 'Jean', numero: 'FAC-2026-0001', montant: 180, echeance: '30/06/2026' },
} satisfies TemplateEntry
