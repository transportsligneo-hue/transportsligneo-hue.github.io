import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  email?: string
  date?: string
  source?: string
  nom?: string
  telephone?: string
  ville?: string
  adresse?: string
}

const Email = ({ email, date, source, nom, telephone, ville, adresse }: Props) => (
  <LigneoEmailShell
    preview={`Nouvelle inscription liste d'attente${nom ? ` — ${nom}` : ''}`}
    tagline="Nouvelle inscription"
    icon="📥"
    title="Nouveau candidat convoyeur"
    greeting="Bonjour,"
    intro="Une nouvelle personne vient de s'inscrire à la liste d'attente sur la page « Devenir convoyeur »."
    primaryCta={{ label: 'Voir les inscrits', href: 'https://transportsligneo.fr/admin/contenu' }}
  >
    <RecapCard
      title="Détails de l’inscription"
      rows={[
        nom && { label: 'Nom', value: nom },
        telephone && { label: 'Téléphone', value: telephone },
        email && { label: 'Email', value: email },
        ville && { label: 'Ville', value: ville },
        adresse && { label: 'Adresse', value: adresse },
        date && { label: 'Date', value: date },
        source && { label: 'Origine', value: source },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[ADMIN] Liste d’attente convoyeur — ${d.nom ?? d.email ?? ''}${d.ville ? ` (${d.ville})` : ''}`,
  displayName: 'Admin — liste d’attente convoyeur',
  previewData: { email: 'candidat@example.com', nom: 'Jean Martin', telephone: '06 12 34 56 78', ville: 'Tours', adresse: '12 rue Nationale, 37000 Tours', date: '20/08/2026 01:30', source: 'Page Devenir convoyeur' },
} satisfies TemplateEntry
