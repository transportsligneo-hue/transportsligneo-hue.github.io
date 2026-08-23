import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  numero?: string
  message?: string
  pdfUrl?: string
}

const Email = ({ numero, message, pdfUrl }: Props) => (
  <LigneoEmailShell
    preview={`Dossier complet${numero ? ` — ${numero}` : ''}`}
    tagline="Dossier de mission"
    icon="📁"
    title={`Dossier complet${numero ? ` — ${numero}` : ''}`}
    greeting="Bonjour,"
    intro={
      message ||
      'Veuillez trouver ci-dessous le dossier complet de la mission : état des lieux départ et arrivée, PV de livraison signé et documents du véhicule.'
    }
    {...(pdfUrl ? { primaryCta: { label: 'Télécharger le dossier (PDF)', href: pdfUrl } } : {})}
  >
    <RecapCard
      rows={[
        numero && { label: 'N° de mission', value: numero },
        { label: 'Contenu', value: 'Couverture, état des lieux, PV de livraison, documents véhicule' },
        pdfUrl && { label: 'Lien de téléchargement', value: 'Valable 30 jours' },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Dossier complet${d.numero ? ` — mission ${d.numero}` : ''} · Transports Ligneo`,
  displayName: 'Dossier complet de mission',
  previewData: { numero: 'MIS-TLG-2026-#107', pdfUrl: 'https://transportsligneo.fr' },
} satisfies TemplateEntry
