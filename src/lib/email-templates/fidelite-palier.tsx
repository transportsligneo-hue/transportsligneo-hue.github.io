import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  km?: string
  palier?: string
  taux?: string
}

const Email = ({ prenom, km, palier, taux }: Props) => (
  <LigneoEmailShell
    preview="Nouveau palier atteint sur votre Compte Kilomètres"
    tagline="Compte Kilomètres Ligneo"
    title="Vous passez au palier supérieur"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`Grâce à vos convoyages, vous venez d'atteindre un nouveau palier de votre Compte Kilomètres. Votre prime de fin de période sera calculée au taux de ${taux ?? ''} % du montant hors taxes facturé sur les 12 derniers mois.`}
    footnote="Retrouvez le détail de votre Compte Kilomètres depuis votre espace client."
  >
    <SimpleCard title={palier ?? 'Nouveau palier'} subtitle={km ? `${km} cumulés sur la période en cours` : ''} />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: () => 'Nouveau palier atteint — Compte Kilomètres Ligneo',
  displayName: 'Fidélité — palier atteint',
  previewData: { prenom: 'Morgane', km: '4 250 km', palier: '4 001 à 10 000 km', taux: '2' },
} satisfies TemplateEntry
