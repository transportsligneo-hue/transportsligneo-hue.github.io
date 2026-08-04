import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell } from './_ligneo-header'

interface Props { prenom?: string; motif?: string }

const Email = ({ prenom, motif }: Props) => (
  <LigneoEmailShell
    preview="Contactez-nous pour plus d'informations."
    tagline="⚠ Compte suspendu"
    taglineTone="warn"
    title="Votre compte a été suspendu"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`Votre compte convoyeur a été temporairement suspendu.${motif ? ` Motif : ${motif}.` : ''} Contactez notre équipe pour comprendre la raison et les conditions de réactivation.`}
    secondaryCta={{ label: 'Contacter le support', href: 'mailto:contact@transportsligneo.fr' }}
  />
)

export const template = {
  component: Email,
  subject: 'Suspension de votre compte convoyeur',
  displayName: 'Convoyeur — suspension',
  previewData: { prenom: 'Olivier', motif: 'Non-respect des conditions générales' },
} satisfies TemplateEntry
