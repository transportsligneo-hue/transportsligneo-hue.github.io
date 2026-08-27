import * as React from 'react'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail?: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <LigneoEmailShell
    preview="Un clic pour valider le changement."
    tagline="Sécurité du compte"
    title="Confirmer votre nouvelle adresse"
    greeting="Bonjour,"
    intro={`Vous avez demandé à changer l'adresse email associée à votre compte ${siteName}. Confirmez ce changement en cliquant ci-dessous.`}
    primaryCta={{ label: 'Confirmer ce changement', href: confirmationUrl }}
    footnote="Si vous n'êtes pas à l'origine de cette demande, contactez-nous immédiatement."
  >
    <RecapCard
      rows={[
        { label: 'Ancien email', value: oldEmail || email },
        { label: 'Nouvel email', value: newEmail },
      ]}
    />
  </LigneoEmailShell>
)

export default EmailChangeEmail
