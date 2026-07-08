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
    preview={`Confirmez votre email — ${siteName}`}
    tagline="Confirmation d'inscription"
    icon="✉"
    title="Confirmez votre adresse email"
    greeting="Bienvenue,"
    intro={`Merci de vous être inscrit sur ${siteName}. Pour finaliser votre inscription, confirmez l'adresse ${recipient} en cliquant sur le bouton ci-dessous.`}
    primaryCta={{ label: 'Vérifier mon email', href: confirmationUrl }}
    signature={"Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité."}
  />
)

export default SignupEmail
