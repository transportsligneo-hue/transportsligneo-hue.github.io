import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  montant?: number | string
  echeance?: string
  clientLogoUrl?: string
  clientName?: string
  /** Lien de téléchargement direct de la facture PDF (URL signée). */
  pdfUrl?: string
}

const Email = ({ prenom, numero, montant, echeance, clientLogoUrl, clientName, pdfUrl }: Props) => (
  <LigneoEmailShell
    preview={`Facture ${numero ?? ''} prête au téléchargement.`}
    tagline="Facturation"
    title="Votre facture est prête"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    primaryCta={{
      label: pdfUrl ? 'Télécharger ma facture (PDF)' : 'Télécharger ma facture',
      href: pdfUrl || 'https://transportsligneo.fr/dashboard-client/documents',
    }}
    secondaryCta={
      pdfUrl
        ? { label: 'Voir mes documents', href: 'https://transportsligneo.fr/dashboard-client/documents' }
        : null
    }
    clientLogoUrl={clientLogoUrl}
    clientName={clientName}
    footnote="TVA non applicable, art. 293 B du CGI."
  >
    <SimpleCard
      title={numero}
      subtitle={[montant ? `${montant} € TTC` : null, echeance ? `Échéance ${echeance}` : null].filter(Boolean).join(' · ')}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Facture${d.numero ? ` n° ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Facture disponible',
  previewData: { prenom: 'Morgane', numero: 'FAC-TLG-2026-114', montant: 120, echeance: '30/06/2026' },
} satisfies TemplateEntry
