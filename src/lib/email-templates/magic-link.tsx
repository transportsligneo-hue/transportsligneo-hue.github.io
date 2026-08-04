import * as React from 'react'
import { LigneoEmailShell } from './_ligneo-header'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <LigneoEmailShell
    preview="Cliquez pour vous connecter sans mot de passe."
    tagline="Connexion sécurisée"
    title="Votre lien de connexion"
    greeting="Bonjour,"
    intro={`Cliquez sur le bouton ci-dessous pour vous connecter instantanément à votre compte ${siteName}, sans mot de passe.`}
    primaryCta={{ label: 'Me connecter', href: confirmationUrl }}
    footnote="Ce lien est valable 15 minutes et à usage unique."
  />
)

export default MagicLinkEmail
