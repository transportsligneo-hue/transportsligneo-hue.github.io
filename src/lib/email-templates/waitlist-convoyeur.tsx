import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  email?: string
  date?: string
  source?: string
}

const Email = ({ email, date, source }: Props) => (
  <LigneoEmailShell
    preview="Votre inscription à la liste d'attente convoyeurs est enregistrée"
    tagline="Liste d'attente"
    icon="✅"
    title="Votre demande est bien enregistrée"
    greeting="Bonjour,"
    intro="Merci pour votre intérêt pour le réseau de convoyeurs Transports Ligneo. Notre réseau est actuellement complet : nous vous recontacterons en priorité dès qu'une place se libère ou que nos besoins évoluent."
    primaryCta={{ label: 'Découvrir Transports Ligneo', href: 'https://transportsligneo.fr' }}
    signature="L'équipe Transports Ligneo"
  >
    <RecapCard
      title="Récapitulatif de votre demande"
      rows={[
        { label: 'Demande', value: 'Rejoindre le réseau de convoyeurs' },
        email && { label: 'Email', value: email },
        date && { label: 'Enregistrée le', value: date },
        source && { label: 'Origine', value: source },
        { label: 'Statut', value: 'En liste d’attente' },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: 'Votre inscription à la liste d’attente convoyeurs — Transports Ligneo',
  displayName: 'Convoyeur — liste d’attente (candidat)',
  previewData: {
    email: 'candidat@example.com',
    date: '20/08/2026 01:30',
    source: 'Page Devenir convoyeur',
  },
} satisfies TemplateEntry
