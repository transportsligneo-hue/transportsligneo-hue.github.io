import * as React from 'react'
import { LigneoEmailShell, CodeBox } from './_ligneo-header'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <LigneoEmailShell
    preview="Code à usage unique — valable 10 minutes."
    tagline="Vérification de sécurité"
    title="Votre code de vérification"
    greeting="Bonjour,"
    intro="Pour confirmer qu'il s'agit bien de vous, saisissez ce code sur la page en cours :"
    footnote="Ce code est valable 10 minutes. Ne le partagez avec personne."
  >
    <CodeBox code={token} />
  </LigneoEmailShell>
)

export default ReauthenticationEmail
