import * as React from 'react'
import { LigneoEmailShell } from './_ligneo-header'
import type { TemplateEntry } from './registry'

interface InviteEmailProps {
  siteName?: string
  siteUrl?: string
  confirmationUrl: string
  organizationName?: string | null
  prenom?: string | null
}

export const InviteEmail = ({ confirmationUrl, organizationName, prenom }: InviteEmailProps) => (
  <LigneoEmailShell
    preview="Rejoignez l'espace de votre entreprise."
    tagline="Invitation"
    title="Vous avez été invité(e)"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={
      organizationName
        ? `${organizationName} vous invite à rejoindre son espace Transports Ligneo en tant que conducteur. Complétez votre profil (permis, documents, RC Pro) pour finaliser votre rattachement.`
        : "Un responsable de votre entreprise vous a invité(e) à rejoindre son espace Transports Ligneo pour gérer les convoyages ensemble."
    }
    primaryCta={{ label: "Accepter l'invitation", href: confirmationUrl }}
    footnote="Cette invitation est valable 7 jours."
  />
)

export const template = {
  component: InviteEmail,
  subject: 'Vous êtes invité(e) sur Transports Ligneo',
  displayName: 'Invitation',
  previewData: {
    confirmationUrl: 'https://transportsligneo.fr/inscription-convoyeur?invite=demo',
    organizationName: 'CAT FRANCE',
    prenom: 'Jean',
  },
} satisfies TemplateEntry

export default InviteEmail
