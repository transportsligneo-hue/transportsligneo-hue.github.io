import * as React from 'react'
import { LigneoEmailShell } from './_ligneo-header'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <LigneoEmailShell
    preview={`Votre lien de connexion — ${siteName}`}
    tagline="Lien de connexion"
    icon="🔑"
    title="Votre lien de connexion"
    greeting="Bonjour,"
    intro={`Cliquez sur le bouton ci-dessous pour vous connecter à ${siteName}. Ce lien expirera sous peu pour votre sécurité.`}
    primaryCta={{ label: 'Se connecter', href: confirmationUrl }}
    signature={"Si vous n'avez pas demandé ce lien, vous pouvez ignorer cet email."}
  />
)

export default MagicLinkEmail
