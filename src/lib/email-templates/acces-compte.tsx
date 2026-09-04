import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  espace?: string
  lienMotDePasse: string
  email?: string
}

const Email = ({ prenom, espace, lienMotDePasse, email }: Props) => (
  <LigneoEmailShell
    preview="Votre accès Transports Ligneo est prêt — choisissez votre mot de passe."
    tagline="Accès à votre espace"
    title={prenom ? `Bienvenue, ${prenom}` : 'Bienvenue'}
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`L'équipe Transports Ligneo vous a ouvert un ${espace || 'espace client'}${
      email ? ` associé à l'adresse ${email}` : ''
    }. Pour l'activer, définissez votre mot de passe personnel en cliquant sur le bouton ci-dessous.`}
    primaryCta={{ label: 'Choisir mon mot de passe', href: lienMotDePasse }}
    footnote="Ce lien est valable 24 heures. Passé ce délai, utilisez « Mot de passe oublié » depuis la page de connexion."
  >
    <SimpleCard
      title="Vous choisissez votre mot de passe"
      subtitle="Personne d'autre ne le connaît : il est créé directement par vous depuis ce lien sécurisé."
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: 'Votre accès Transports Ligneo — créez votre mot de passe',
  displayName: 'Accès compte créé par l’admin',
  previewData: {
    prenom: 'Morgane',
    espace: 'espace client',
    email: 'morgane@exemple.fr',
    lienMotDePasse: 'https://transportsligneo.fr/reset-password',
  },
} satisfies TemplateEntry

export default Email
