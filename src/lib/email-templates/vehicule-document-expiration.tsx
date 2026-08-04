import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

interface DocLine {
  vehicule?: string
  immatriculation?: string
  document?: string
  echeance?: string
  jours?: number
}

interface Props {
  prenom?: string
  societe?: string
  documents?: DocLine[]
  clientLogoUrl?: string
  clientName?: string
}

function statusLabel(jours?: number) {
  if (jours === undefined || jours === null) return ''
  if (jours < 0) return `Expiré depuis ${Math.abs(jours)} j`
  if (jours === 0) return "Expire aujourd'hui"
  return `Expire dans ${jours} j`
}

const Email = ({ prenom, societe, documents = [], clientLogoUrl, clientName }: Props) => {
  const expired = documents.filter((d) => (d.jours ?? 0) < 0).length
  return (
    <LigneoEmailShell
      preview={`${documents.length} document${documents.length > 1 ? 's' : ''} véhicule à renouveler`}
      tagline="Alerte documents"
      icon="⚠️"
      title="Documents véhicules à renouveler"
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      intro={`Certains documents de votre parc${societe ? ` (${societe})` : ''} arrivent à échéance. Merci de les mettre à jour depuis votre espace Flotte afin de garantir la conformité de vos véhicules.`}
      primaryCta={{ label: 'Ouvrir le parc véhicules', href: 'https://transportsligneo.fr/dashboard-pro/flotte' }}
      clientLogoUrl={clientLogoUrl}
      clientName={clientName}
    >
      <HighlightBox
        label={expired > 0 ? 'Documents expirés' : 'Documents à renouveler'}
        value={`${expired > 0 ? expired : documents.length} document${(expired > 0 ? expired : documents.length) > 1 ? 's' : ''} concerné${(expired > 0 ? expired : documents.length) > 1 ? 's' : ''}`}
        tone={expired > 0 ? 'danger' : 'gold'}
      />
      {documents.map((d, i) => (
        <RecapCard
          key={i}
          rows={[
            (d.vehicule || d.immatriculation) && {
              label: 'Véhicule',
              value: [d.vehicule, d.immatriculation].filter(Boolean).join(' · '),
            },
            d.document && { label: 'Document', value: d.document },
            d.echeance && { label: 'Échéance', value: d.echeance },
            d.jours !== undefined && { label: 'Statut', value: statusLabel(d.jours) },
          ].filter(Boolean) as any}
        />
      ))}
    </LigneoEmailShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Documents véhicules à renouveler${Array.isArray(d.documents) && d.documents.length ? ` (${d.documents.length})` : ''} — Transports Ligneo`,
  displayName: 'Alerte expiration documents véhicule',
  previewData: {
    prenom: 'Camille',
    societe: 'Flotte Demo',
    documents: [
      { vehicule: 'Renault Clio', immatriculation: 'AA-123-BB', document: 'Assurance', echeance: '30/06/2026', jours: 12 },
      { vehicule: 'Peugeot 208', immatriculation: 'CC-456-DD', document: 'Contrôle technique', echeance: '01/06/2026', jours: -3 },
    ],
  },
} satisfies TemplateEntry
