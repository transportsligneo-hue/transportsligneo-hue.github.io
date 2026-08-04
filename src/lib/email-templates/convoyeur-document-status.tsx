import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

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
  const title = LABELS[statut ?? ''] ?? 'Mise à jour de vos documents'
  const refused = statut !== 'approuve'
  return (
    <LigneoEmailShell
      preview={`${title}${document ? ` — ${document}` : ''}`}
      tagline="Dossier convoyeur"
      icon={refused ? '📄' : '✅'}
      title={title}
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      intro={
        refused
          ? "Un document de votre dossier convoyeur nécessite une action de votre part. Merci de le déposer à nouveau depuis votre espace convoyeur pour poursuivre la validation."
          : 'Votre document a bien été validé par notre équipe. Votre dossier avance, merci !'
      }
      primaryCta={{ label: 'Mettre à jour mes documents', href: 'https://transportsligneo.fr/convoyeur/documents' }}
    >
      <RecapCard
        rows={[
          document && { label: 'Document', value: document },
          statut && { label: 'Statut', value: LABELS[statut] ?? statut },
        ].filter(Boolean) as any}
      />
      {motif ? <HighlightBox label="Motif" value={motif} tone={refused ? 'danger' : 'success'} /> : null}
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
