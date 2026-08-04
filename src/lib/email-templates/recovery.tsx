import * as React from 'react'
import { LigneoEmailShell } from './_ligneo-header'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <LigneoEmailShell
    preview="Cliquez pour choisir un nouveau mot de passe — lien valable 1h."
    tagline="Sécurité du compte"
    title="Réinitialiser votre mot de passe"
    greeting="Bonjour,"
    intro={`Vous avez demandé la réinitialisation de votre mot de passe ${siteName}. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.`}
    primaryCta={{ label: 'Choisir un nouveau mot de passe', href: confirmationUrl }}
    footnote="Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe actuel reste inchangé."
  />
)

export default RecoveryEmail
