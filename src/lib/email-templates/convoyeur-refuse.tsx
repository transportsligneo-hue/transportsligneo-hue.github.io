import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, HighlightBox } from './_ligneo-header'

interface Props { prenom?: string; motif?: string }

const Email = ({ prenom, motif }: Props) => (
  <LigneoEmailShell
    preview="Suite à votre candidature — Transports Ligneo"
    tagline="Décision"
    icon="ℹ"
    title="Suite à votre candidature"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Après étude attentive de votre dossier, nous ne pouvons malheureusement pas donner suite à votre candidature pour le moment. Nous vous remercions pour l'intérêt porté à Transports Ligneo."
  >
    {motif ? (
      <HighlightBox label="Motif" value={motif} tone="danger" />
    ) : null}
    <HighlightBox
      label="Bon à savoir"
      value="Vous pouvez soumettre une nouvelle candidature ultérieurement en tenant compte de nos critères de sélection."
      tone="navy"
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: 'Réponse à votre candidature — Transports Ligneo',
  displayName: 'Convoyeur — refus',
  previewData: { prenom: 'Thomas', motif: 'Documents non conformes' },
} satisfies TemplateEntry
