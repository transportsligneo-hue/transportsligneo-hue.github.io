import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  montant?: string
  km?: string
  taux?: string
  expiration?: string
  ctaUrl?: string
}

const Email = ({ prenom, montant, km, taux, expiration, ctaUrl }: Props) => (
  <LigneoEmailShell
    preview="Votre prime fidélité a été créditée"
    tagline="Compte Kilomètres Ligneo"
    title="Votre prime annuelle est créditée"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`Votre période de référence de 12 mois vient de se clôturer. Avec ${km ?? '0 km'} parcourus, un taux de ${taux ?? '0'} % a été appliqué au montant hors taxes facturé sur la période. Le montant correspondant est désormais disponible en avoir sur votre Compte Kilomètres.`}
    primaryCta={ctaUrl ? { label: 'Voir mon Compte Kilomètres', href: ctaUrl } : null}
    footnote={
      expiration
        ? `Cet avoir est utilisable sur vos prochains convoyages jusqu'au ${expiration}.`
        : "Cet avoir est utilisable sur vos prochains convoyages pendant 24 mois."
    }
  >
    <SimpleCard title={montant ? `Avoir crédité : ${montant}` : 'Avoir crédité'} subtitle={km ? `${km} sur la période écoulée` : ''} />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Votre prime fidélité${d.montant ? ` de ${d.montant}` : ''} est créditée — Transports Ligneo`,
  displayName: 'Fidélité — avoir crédité',
  previewData: {
    prenom: 'Morgane',
    montant: '186,40 €',
    km: '9 320 km',
    taux: '2',
    expiration: '12 février 2028',
    ctaUrl: 'https://transportsligneo.fr/dashboard-client/fidelite',
  },
} satisfies TemplateEntry
