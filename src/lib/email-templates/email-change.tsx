import * as React from 'react'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <LigneoEmailShell
    preview={`Confirmez le changement d'email — ${siteName}`}
    tagline="Changement d'email"
    icon="✉"
    title="Confirmez le changement d'email"
    greeting="Bonjour,"
    intro={`Vous avez demandé à changer votre adresse email pour ${siteName}. Confirmez ce changement en cliquant sur le bouton ci-dessous.`}
    primaryCta={{ label: 'Confirmer le changement', href: confirmationUrl }}
    signature={"Si vous n'avez pas demandé ce changement, sécurisez votre compte immédiatement."}
  >
    <RecapCard
      rows={[
        { label: 'Ancien email', value: email },
        { label: 'Nouvel email', value: newEmail },
      ]}
    />
  </LigneoEmailShell>
)

export default EmailChangeEmail
