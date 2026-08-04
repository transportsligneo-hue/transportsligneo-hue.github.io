import * as React from 'react'
import { LigneoEmailShell } from './_ligneo-header'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <LigneoEmailShell
    preview="Rejoignez l'espace de votre entreprise."
    tagline="Invitation"
    title="Vous avez été invité(e)"
    greeting="Bonjour,"
    intro="Un responsable de votre entreprise vous a invité(e) à rejoindre son espace Transports Ligneo pour gérer les convoyages ensemble."
    primaryCta={{ label: "Accepter l'invitation", href: confirmationUrl }}
    footnote="Cette invitation est valable 7 jours."
  />
)

export default InviteEmail
