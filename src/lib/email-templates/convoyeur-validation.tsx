import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { prenom?: string }

const Email = ({ prenom }: Props) => (
  <LigneoEmailShell
    preview="Bienvenue dans le réseau — signez votre contrat pour démarrer."
    tagline="Candidature acceptée"
    title={prenom ? `Bienvenue dans le réseau, ${prenom} 🎉` : 'Bienvenue dans le réseau 🎉'}
    intro="Votre dossier a été validé par notre équipe. Il ne reste qu'une dernière étape avant de pouvoir accepter vos premières missions : la signature électronique de votre contrat de partenariat."
    secondaryCta={{ label: 'Signer mon contrat', href: 'https://transportsligneo.fr/convoyeur/contrat' }}
  >
    <SimpleCard
      title="Une fois signé"
      subtitle="Vous aurez accès au catalogue de missions disponibles et pourrez commencer à convoyer dès aujourd'hui."
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: 'Votre compte convoyeur est validé — Transports Ligneo',
  displayName: 'Convoyeur — validation',
  previewData: { prenom: 'Olivier' },
} satisfies TemplateEntry
