import * as React from 'react'
import { LigneoEmailShell } from './_ligneo-header'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <LigneoEmailShell
    preview={`Réinitialisez votre mot de passe — ${siteName}`}
    tagline="Réinitialisation"
    icon="🔒"
    title="Réinitialisez votre mot de passe"
    greeting="Bonjour,"
    intro={`Nous avons reçu une demande de réinitialisation de votre mot de passe pour ${siteName}. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.`}
    primaryCta={{ label: 'Réinitialiser le mot de passe', href: confirmationUrl }}
    signature={"Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email — votre mot de passe ne sera pas modifié."}
  />
)

export default RecoveryEmail
