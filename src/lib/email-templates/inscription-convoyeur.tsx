import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { prenom?: string }

const Email = ({ prenom }: Props) => (
  <LigneoEmailShell
    preview="Votre dossier est en cours d'étude — réponse sous 24 à 48h."
    tagline="Candidature convoyeur"
    title={prenom ? `Dossier bien reçu, ${prenom}` : 'Dossier bien reçu'}
    intro="Merci pour votre candidature pour rejoindre le réseau de convoyeurs Transports Ligneo. Votre dossier est en cours d'étude par notre équipe."
    primaryCta={{ label: 'Suivre ma candidature', href: 'https://transportsligneo.fr/convoyeur' }}
    footnote="En attendant, vérifiez que tous vos documents sont bien à jour (permis, pièce d'identité, Kbis/SIRENE, attestation RC Pro) pour accélérer le traitement de votre candidature."
  >
    <SimpleCard
      title="Délai de réponse"
      subtitle="Sous 24 à 48h ouvrées — vous recevrez un email dès que votre dossier sera validé."
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: 'Votre candidature convoyeur — Transports Ligneo',
  displayName: 'Inscription convoyeur',
  previewData: { prenom: 'Olivier' },
} satisfies TemplateEntry
