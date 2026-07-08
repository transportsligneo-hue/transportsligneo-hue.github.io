import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, HighlightBox } from './_ligneo-header'

interface Props { prenom?: string; motif?: string }

const Email = ({ prenom, motif }: Props) => (
  <LigneoEmailShell
    preview="Suspension de compte convoyeur"
    tagline="Compte suspendu"
    icon="⚠"
    title="Compte convoyeur suspendu"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Nous vous informons que votre compte convoyeur a été temporairement suspendu. Vous ne pouvez plus accéder aux missions le temps que la situation soit régularisée."
    primaryCta={{ label: 'Nous contacter', href: 'mailto:contact@transportsligneo.fr' }}
  >
    {motif ? <HighlightBox label="Motif" value={motif} tone="danger" /> : null}
    <HighlightBox
      label="Prochaine étape"
      value="Contactez notre équipe support afin d'échanger sur les raisons de cette suspension et les conditions de réactivation."
      tone="navy"
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: 'Suspension de votre compte convoyeur',
  displayName: 'Convoyeur — suspension',
  previewData: { prenom: 'Thomas', motif: 'Non-respect des conditions générales' },
} satisfies TemplateEntry
