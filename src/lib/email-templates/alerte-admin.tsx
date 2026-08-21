import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  titre?: string
  message?: string
  lien?: string
  categorie?: string
  details?: { label: string; value: string }[]
  recu_le?: string
}

const Email = ({ titre, message, lien, categorie, details, recu_le }: Props) => (
  <LigneoEmailShell
    preview={titre || 'Nouvelle activité sur la plateforme'}
    tagline="Alerte plateforme"
    icon="🔔"
    title={titre || 'Nouvelle activité'}
    greeting="Bonjour,"
    intro={message || "Une nouvelle activité vient d'être enregistrée sur la plateforme."}
    primaryCta={{
      label: 'Ouvrir dans l’admin',
      href: lien || 'https://transportsligneo.fr/admin',
    }}
  >
    <RecapCard
      title={categorie || 'Détails'}
      rows={[
        recu_le && { label: 'Reçu le', value: recu_le },
        ...(Array.isArray(details) ? details.filter((d) => d && d.value) : []),
      ].filter(Boolean) as { label: string; value: string }[]}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (data) => `🔔 ${data?.titre || 'Nouvelle activité'} — Transports Ligneo`,
  displayName: 'Alerte admin (plateforme)',
  previewData: {
    titre: 'Nouvelle demande de convoyage',
    message: 'Morgane Landais — Tours → Paris',
    categorie: 'Demande de convoyage',
    lien: 'https://transportsligneo.fr/admin/demandes',
    recu_le: '21/08/2026 19:05',
    details: [
      { label: 'Client', value: 'Morgane Landais' },
      { label: 'Email', value: 'client@example.com' },
    ],
  },
} satisfies TemplateEntry
