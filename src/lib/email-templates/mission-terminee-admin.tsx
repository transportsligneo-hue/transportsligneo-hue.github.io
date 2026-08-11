import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  numero?: string
  trajet?: string
  vehicule?: string
  immatriculation?: string
  convoyeur?: string
  client?: string
  terminee_le?: string
  lien?: string
}

const Email = ({ numero, trajet, vehicule, immatriculation, convoyeur, client, terminee_le, lien }: Props) => (
  <LigneoEmailShell
    preview={`Mission terminée${numero ? ` — ${numero}` : ''}`}
    tagline="Mission terminée"
    icon="✅"
    title="Une mission vient d'être terminée"
    greeting="Bonjour,"
    intro="Le convoyeur a finalisé la mission et transmis le dossier complet (état des lieux, photos et signatures). Elle est en attente de votre validation."
    primaryCta={{ label: 'Ouvrir la mission', href: lien || 'https://transportsligneo.fr/admin/exploitation' }}
  >
    <RecapCard
      rows={[
        numero && { label: 'N° de mission', value: numero },
        trajet && { label: 'Trajet', value: trajet },
        vehicule && { label: 'Véhicule', value: vehicule },
        immatriculation && { label: 'Immatriculation', value: immatriculation },
        convoyeur && { label: 'Convoyeur', value: convoyeur },
        client && { label: 'Client', value: client },
        terminee_le && { label: 'Terminée le', value: terminee_le },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[ADMIN] Mission terminée${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Admin — mission terminée',
  previewData: {
    numero: 'MIS-TLG-2026-#104',
    trajet: 'Tours → Paris',
    vehicule: 'Renault Clio',
    immatriculation: 'AB-123-CD',
    convoyeur: 'Thomas D.',
    client: 'Garage Dupont',
    terminee_le: '11/08/2026 10:42',
    lien: 'https://transportsligneo.fr/admin/exploitation',
  },
} satisfies TemplateEntry
