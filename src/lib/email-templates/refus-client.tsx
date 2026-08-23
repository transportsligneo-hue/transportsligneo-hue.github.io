import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  objet?: string
  numero?: string
  motif?: string
  trajet?: string
}

const Email = ({ prenom, objet, numero, motif, trajet }: Props) => {
  const label = objet || 'demande'
  return (
    <LigneoEmailShell
      preview={`Votre ${label}${numero ? ` n° ${numero}` : ''} n'a pas pu être retenue.`}
      tagline="Suite à votre demande"
      title={`Votre ${label} n'a pas été retenue`}
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      intro={`Après étude, nous ne sommes malheureusement pas en mesure de donner suite à votre ${label}${numero ? ` n° ${numero}` : ''}. Nous vous remercions de la confiance que vous nous avez accordée.`}
      primaryCta={{ label: 'Nous contacter', href: 'https://transportsligneo.fr/contact' }}
      footnote="Notre équipe reste à votre disposition pour étudier toute nouvelle demande de convoyage."
    >
      {trajet ? <SimpleCard title="Trajet concerné" subtitle={trajet} /> : null}
      {motif ? <SimpleCard title="Motif" subtitle={motif} /> : null}
    </LigneoEmailShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Votre ${d.objet || 'demande'}${d.numero ? ` n° ${d.numero}` : ''} — suite donnée`,
  displayName: 'Refus client (demande / devis / mission)',
  previewData: {
    prenom: 'Max',
    objet: 'demande de convoyage',
    numero: 'DEM-2026-0042',
    trajet: '38110 La Tour-du-Pin → 78114 Magny-les-Hameaux',
    motif: "Plaque d'immatriculation non confirmée dans les délais.",
  },
} satisfies TemplateEntry
