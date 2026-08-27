import * as React from 'react'
import { LigneoEmailShell } from './_ligneo-header'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, recipient, confirmationUrl }: SignupEmailProps) => (
  <LigneoEmailShell
    preview={`Un clic pour activer votre compte ${siteName}.`}
    tagline="Confirmation d'inscription"
    title="Plus qu'une étape"
    greeting="Bonjour,"
    intro={`Merci de vous être inscrit sur ${siteName}. Cliquez ci-dessous pour confirmer votre adresse email${recipient ? ` (${recipient})` : ''} et activer votre compte.`}
    primaryCta={{ label: 'Confirmer mon adresse email', href: confirmationUrl }}
    footnote="Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email."
  />
)

export default SignupEmail
