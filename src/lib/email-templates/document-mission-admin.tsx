import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props { numero?: string; type?: string; convoyeur?: string; commentaire?: string }

const Email = ({ numero, type, convoyeur, commentaire }: Props) => (
  <LigneoEmailShell
    preview={`Nouveau document mission${numero ? ` — ${numero}` : ''}`}
    tagline="Document déposé"
    icon="📎"
    title="Nouveau document de mission"
    greeting="Bonjour,"
    intro="Un nouveau document vient d'être ajouté à une mission par le convoyeur."
    primaryCta={{ label: 'Voir la mission', href: 'https://transportsligneo.fr/admin/exploitation' }}
  >
    <RecapCard
      rows={[
        numero && { label: 'N° de mission', value: numero },
        type && { label: 'Type de document', value: type },
        convoyeur && { label: 'Convoyeur', value: convoyeur },
        commentaire && { label: 'Commentaire', value: commentaire },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[ADMIN] Document mission${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Admin — document mission',
  previewData: { numero: 'MIS-2026-0001', type: 'État des lieux', convoyeur: 'Thomas D.', commentaire: 'RAS' },
} satisfies TemplateEntry
