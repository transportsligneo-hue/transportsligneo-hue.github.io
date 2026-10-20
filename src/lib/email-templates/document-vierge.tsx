import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  documentNom?: string
  message?: string
  pdfUrl?: string
}

const Email = ({ documentNom, message, pdfUrl }: Props) => (
  <LigneoEmailShell
    preview={`${documentNom || 'Document'} — Transports Ligneo`}
    tagline="Document"
    icon="📄"
    title={documentNom || 'Document'}
    greeting="Bonjour,"
    intro={
      message ||
      'Veuillez trouver ci-dessous le document demandé. Vous pouvez le télécharger, l’imprimer et le remplir.'
    }
    {...(pdfUrl ? { primaryCta: { label: 'Télécharger le document (PDF)', href: pdfUrl } } : {})}
  >
    <RecapCard
      rows={[
        documentNom && { label: 'Document', value: documentNom },
        pdfUrl && { label: 'Lien de téléchargement', value: 'Valable 30 jours' },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${d.documentNom || 'Document'} · Transports Ligneo`,
  displayName: 'Document vierge',
  previewData: { documentNom: 'PV de livraison', pdfUrl: 'https://transportsligneo.fr' },
} satisfies TemplateEntry
