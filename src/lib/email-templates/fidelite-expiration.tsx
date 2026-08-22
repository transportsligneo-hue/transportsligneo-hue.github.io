import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  montant?: string
  expiration?: string
  ctaUrl?: string
}

const Email = ({ prenom, montant, expiration, ctaUrl }: Props) => (
  <LigneoEmailShell
    preview="Votre avoir expire dans 30 jours"
    tagline="Compte Kilomètres Ligneo"
    title="Votre avoir expire bientôt"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`Il vous reste un avoir non utilisé sur votre Compte Kilomètres. Il expirera le ${expiration ?? 'mois prochain'} : vous pouvez le déduire du montant de votre prochain convoyage, en France comme en Europe.`}
    primaryCta={ctaUrl ? { label: 'Utiliser mon avoir', href: ctaUrl } : null}
    footnote="Une question sur votre Compte Kilomètres ? Répondez simplement à cet email."
  >
    <SimpleCard title={montant ? `Avoir disponible : ${montant}` : 'Avoir disponible'} subtitle={expiration ? `À utiliser avant le ${expiration}` : ''} />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: () => 'Votre avoir fidélité expire dans 30 jours — Transports Ligneo',
  displayName: 'Fidélité — expiration d’avoir',
  previewData: {
    prenom: 'Morgane',
    montant: '186,40 €',
    expiration: '12 mars 2028',
    ctaUrl: 'https://transportsligneo.fr/dashboard-client/fidelite',
  },
} satisfies TemplateEntry
