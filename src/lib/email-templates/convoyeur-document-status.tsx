import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  nom?: string
  document?: string
  statut?: string
  motif?: string
}

const LABELS: Record<string, string> = {
  approuve: 'Document approuvé',
  refuse: 'Document refusé',
  a_renvoyer: 'Document à renvoyer',
}

const Email = ({ prenom, document, statut, motif }: Props) => {
  const refused = statut !== 'approuve'
  const title = refused ? 'Un document doit être mis à jour' : 'Document validé ✓'
  return (
    <LigneoEmailShell
      preview={refused ? 'Action requise sur votre dossier convoyeur.' : 'Votre document a été validé.'}
      tagline={refused ? '⚠ Documents' : 'Documents'}
      taglineTone={refused ? 'warn' : 'blue'}
      title={title}
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      intro={
        refused
          ? "Un document de votre dossier convoyeur nécessite une action de votre part. Merci de le déposer à nouveau depuis votre espace convoyeur."
          : 'Votre document a bien été validé par notre équipe. Votre dossier avance, merci !'
      }
      primaryCta={{ label: refused ? 'Mettre à jour mes documents' : 'Voir mon dossier', href: 'https://transportsligneo.fr/convoyeur/documents' }}
    >
      <SimpleCard
        title={document || 'Document'}
        subtitle={[LABELS[statut ?? ''] ?? statut, motif].filter(Boolean).join(' · ')}
      />
    </LigneoEmailShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `${LABELS[d.statut] ?? 'Mise à jour de votre dossier'}${d.document ? ` — ${d.document}` : ''} — Transports Ligneo`,
  displayName: 'Statut document convoyeur',
  previewData: { prenom: 'Thomas', document: 'Permis de conduire', statut: 'a_renvoyer', motif: 'Photo illisible' },
} satisfies TemplateEntry
