import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  email: string
  telephone?: string
  raison?: string
  date?: string
}

const Email = ({ email, telephone, raison, date }: Props) => (
  <LigneoEmailShell
    preview="Demande de suppression de compte convoyeur"
    tagline="Suppression de compte"
    icon="🛡️"
    title="Demande de suppression de compte"
    greeting="Bonjour,"
    intro="Un convoyeur a demandé la suppression de son compte et de ses données via la page dédiée."
    primaryCta={{ label: 'Espace admin', href: 'https://transportsligneo.fr/admin/utilisateurs' }}
  >
    <RecapCard
      title="Détails de la demande"
      rows={[
        { label: 'Email du compte', value: email },
        telephone && { label: 'Téléphone', value: telephone },
        raison && { label: 'Motif', value: raison },
        date && { label: 'Date de la demande', value: date },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: '[ADMIN] Demande de suppression de compte convoyeur',
  displayName: 'Admin — suppression de compte',
  previewData: {
    email: 'convoyeur@example.com',
    telephone: '06 12 34 56 78',
    raison: 'Arrêt de l\'activité',
    date: '10/08/2026',
  },
} satisfies TemplateEntry
