import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

interface Props {
  societe?: string
  contact?: string
  email?: string
  nbDemandes?: number | string
  score?: number | string
  categorie?: string
  motif?: string
}

const Email = ({ societe, contact, email, nbDemandes, score, categorie, motif }: Props) => (
  <LigneoEmailShell
    preview={`Suggestion conversion flotte — ${societe ?? ''}`}
    tagline="Suggestion IA"
    icon="✨"
    title="Suggestion — conversion flotte"
    greeting="Bonjour,"
    intro="Notre moteur de scoring a identifié un client B2B avec un potentiel élevé de conversion vers une offre flotte."
    primaryCta={{ label: 'Voir le client', href: 'https://transportsligneo.fr/admin/clients' }}
  >
    <HighlightBox
      label={`Score prospect ${categorie ?? ''}`}
      value={`${score ?? 0} / 100`}
      tone="gold"
    />
    <RecapCard
      rows={[
        societe && { label: 'Société', value: societe },
        contact && { label: 'Contact', value: contact },
        email && { label: 'Email', value: email },
        nbDemandes && { label: 'Nb de demandes', value: `${nbDemandes}` },
        motif && { label: 'Motif suggestion', value: motif },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[SUGGESTION] Conversion flotte — ${d.societe ?? ''}`,
  displayName: 'Admin — suggestion conversion',
  previewData: {
    societe: 'ACME SAS', contact: 'Jean Dupont', email: 'jean@acme.com',
    nbDemandes: 5, score: 82, categorie: 'HOT',
    motif: '5 demandes en 30 jours + urgence immédiate + effectif 51-250',
  },
} satisfies TemplateEntry
