import * as React from 'react'
import { LigneoEmailShell, HighlightBox } from './_ligneo-header'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <LigneoEmailShell
    preview="Votre code de vérification"
    tagline="Code de vérification"
    icon="🔐"
    title="Confirmez votre identité"
    greeting="Bonjour,"
    intro="Utilisez le code ci-dessous pour confirmer votre identité. Ce code expirera sous peu pour votre sécurité."
    signature={"Si vous n'avez pas fait cette demande, vous pouvez ignorer cet email."}
  >
    <HighlightBox label="Code de vérification" value={token} tone="gold" />
  </LigneoEmailShell>
)

export default ReauthenticationEmail
