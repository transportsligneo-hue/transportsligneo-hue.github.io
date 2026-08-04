import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell } from './_ligneo-header'

interface Props { prenom?: string; motif?: string }

const Email = ({ prenom, motif }: Props) => (
  <LigneoEmailShell
    preview="Réponse concernant votre dossier."
    tagline="Candidature convoyeur"
    title="Concernant votre candidature"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`Après étude de votre dossier, nous ne sommes malheureusement pas en mesure de donner suite à votre candidature pour le moment.${motif ? ` Motif : ${motif}.` : ''}`}
    footnote="N'hésitez pas à nous recontacter si votre situation évolue (documents, expérience) — nous réexaminerons votre dossier avec plaisir."
  />
)

export const template = {
  component: Email,
  subject: 'Réponse à votre candidature — Transports Ligneo',
  displayName: 'Convoyeur — refus',
  previewData: { prenom: 'Olivier', motif: 'Documents non conformes' },
} satisfies TemplateEntry
