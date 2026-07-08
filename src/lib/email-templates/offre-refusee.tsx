import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, HighlightBox } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; motif?: string }

const Email = ({ prenom, numero, motif }: Props) => (
  <LigneoEmailShell
    preview={`Offre non retenue${numero ? ` — ${numero}` : ''}`}
    tagline="Offre non retenue"
    icon="ℹ"
    title="Offre non retenue"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`Nous vous remercions pour votre proposition${numero ? ` sur la mission n° ${numero}` : ''}. Malheureusement, votre offre n'a pas été retenue cette fois-ci.`}
    primaryCta={{ label: 'Voir le catalogue', href: 'https://transportsligneo.fr/convoyeur/catalogue' }}
  >
    {motif ? <HighlightBox label="Motif" value={motif} tone="navy" /> : null}
    <HighlightBox
      label="Bon à savoir"
      value="De nouvelles missions sont publiées quotidiennement dans le catalogue."
      tone="navy"
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Offre non retenue${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Offre refusée (convoyeur)',
  previewData: { prenom: 'Thomas', numero: 'MIS-2026-0001', motif: 'Prix trop élevé' },
} satisfies TemplateEntry
