import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  depart?: string
  arrivee?: string
  date?: string
  prestation?: string
  prix?: number | string
}

const Email = ({ prenom, numero, depart, arrivee, date, prestation, prix }: Props) => (
  <LigneoEmailShell
    preview={`Mission créée — ${numero ?? ''}`}
    tagline="Mission créée"
    icon="🚗"
    title="Mission créée"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Votre mission a été créée avec succès. Notre équipe se charge dès à présent de l'organisation."
    primaryCta={{ label: 'Voir la mission', href: 'https://transportsligneo.fr/dashboard-client/missions' }}
  >
    <RecapCard
      title="Récapitulatif de la mission"
      rows={[
        numero && { label: 'N° de mission', value: numero },
        depart && { label: 'Départ', value: depart },
        arrivee && { label: 'Arrivée', value: arrivee },
        date && { label: 'Date', value: date },
        prestation && { label: 'Prestation', value: prestation },
        prix && { label: 'Montant TTC', value: `${prix} €` },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Mission créée${d.numero ? ` — ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Mission — confirmation',
  previewData: {
    prenom: 'Jean', numero: 'MIS-2026-0001', depart: 'TOURS (37)', arrivee: 'LE MANS (72)',
    date: '20/06/2026', prestation: 'Aller / Retour', prix: 180,
  },
} satisfies TemplateEntry
