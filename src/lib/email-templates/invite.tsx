import * as React from 'react'
import { LigneoEmailShell } from './_ligneo-header'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, confirmationUrl }: InviteEmailProps) => (
  <LigneoEmailShell
    preview={`Vous êtes invité à rejoindre ${siteName}`}
    tagline="Invitation"
    icon="✉"
    title="Vous êtes invité"
    greeting="Bonjour,"
    intro={`Vous avez été invité à rejoindre ${siteName}. Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte en quelques instants.`}
    primaryCta={{ label: "Accepter l'invitation", href: confirmationUrl }}
    signature={"Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email."}
  />
)

export default InviteEmail
