import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  numero?: string
  plaque?: string
  code?: string
  destinataire?: string
  suiviUrl?: string
}

const Email = ({ numero, code, destinataire, suiviUrl }: Props) => (
  <LigneoEmailShell
    preview={`Suivez votre véhicule en direct${plaque ? ` — ${plaque}` : ''}`}
    tagline="Suivi GPS"
    title="Suivez votre véhicule en direct"
    greeting={destinataire ? `Bonjour ${destinataire},` : 'Bonjour,'}
    primaryCta={{ label: 'Suivre mon véhicule', href: suiviUrl || 'https://www.transportsligneo.fr/suivi' }}
  >
    <SimpleCard
      title={plaque ? `Véhicule ${plaque}` : `Mission ${numero ?? ''}`}
      subtitle={`Code confidentiel : ${code ?? ''}`}
    />
    <SimpleCard
      title="Comment accéder au suivi ?"
      subtitle={`1. Cliquez sur « Suivre mon véhicule ». 2. Tapez la plaque d'immatriculation du véhicule${plaque ? ` (${plaque})` : ''}, puis le code confidentiel ci-dessus. 3. La carte affiche la position de votre véhicule pendant le convoyage. Aucun compte n'est nécessaire. Ne partagez ce code qu'avec les personnes concernées.`}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d) => `Transports Ligneo — suivez votre véhicule${d.plaque ? ` ${d.plaque}` : ''}`,
  displayName: 'Code de suivi GPS destinataire',
  previewData: { numero: 'TLG-2026-#120', plaque: 'AB-123-CD', code: 'K7P9XQ', destinataire: 'Marie', suiviUrl: 'https://www.transportsligneo.fr/suivi' },
} satisfies TemplateEntry
