import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; motif?: string }

const Email = ({ prenom, numero, motif }: Props) => (
  <LigneoEmailShell
    preview="De nouvelles missions sont disponibles au catalogue."
    tagline="Offre non retenue"
    title="Offre non retenue"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`Nous vous remercions pour votre proposition${numero ? ` sur la mission n° ${numero}` : ''}. Malheureusement, votre offre n'a pas été retenue cette fois-ci.`}
    primaryCta={{ label: 'Voir le catalogue', href: 'https://transportsligneo.fr/convoyeur/catalogue' }}
    footnote="De nouvelles missions sont publiées quotidiennement dans le catalogue."
  >
    {motif ? <SimpleCard title="Motif" subtitle={motif} /> : null}
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Offre non retenue${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Offre refusée (convoyeur)',
  previewData: { prenom: 'Thomas', numero: 'MIS-2026-0001', motif: 'Prix trop élevé' },
} satisfies TemplateEntry
