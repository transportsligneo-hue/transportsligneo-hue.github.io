import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, HighlightBox } from './_ligneo-header'

interface Props { prenom?: string }

const Email = ({ prenom }: Props) => (
  <LigneoEmailShell
    preview="Votre candidature convoyeur a bien été reçue"
    tagline="Candidature reçue"
    icon="🧑‍💼"
    title="Candidature convoyeur reçue"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Nous avons bien reçu votre inscription en tant que convoyeur professionnel. Notre équipe étudie votre dossier et reviendra vers vous très prochainement."
    primaryCta={{ label: 'Accéder à mon espace', href: 'https://transportsligneo.fr/convoyeur' }}
  >
    <HighlightBox
      label="Prochaine étape"
      value="Vérification de vos documents et validation du profil sous 48h ouvrées."
      tone="navy"
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: 'Votre candidature convoyeur — Transports Ligneo',
  displayName: 'Inscription convoyeur',
  previewData: { prenom: 'Thomas' },
} satisfies TemplateEntry
