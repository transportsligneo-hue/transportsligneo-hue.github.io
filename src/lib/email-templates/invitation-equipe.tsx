import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  societe?: string
  role?: string
  lien: string
  invitant?: string
}

const Email = ({ societe, role, lien, invitant }: Props) => (
  <LigneoEmailShell
    preview={`Vous êtes invité à rejoindre ${societe || 'votre équipe'} sur Transports Ligneo.`}
    tagline="Invitation équipe"
    title="Rejoignez votre équipe"
    greeting="Bonjour,"
    intro={`${invitant || 'Un administrateur'} vous invite à rejoindre l'espace ${societe || 'professionnel'} sur Transports Ligneo, avec le rôle « ${role || 'Logistique'} ».`}
    primaryCta={{ label: "Accepter l'invitation", href: lien }}
    footnote="Ce lien est valable 7 jours. Connectez-vous ou créez votre compte avec cette même adresse e-mail. Pensez à vérifier vos spams si vous ne trouvez pas nos messages."
  >
    <SimpleCard title="Un accès adapté à votre rôle" subtitle="Administrateur, Logistique ou Comptabilité : vous ne voyez que ce qui vous concerne." />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Invitation à rejoindre ${d.societe || 'votre équipe'} — Transports Ligneo`,
  displayName: 'Invitation équipe pro',
  previewData: { societe: 'Exemple SAS', role: 'Logistique', lien: 'https://transportsligneo.fr/invitation-equipe/abc', invitant: 'Marie' },
} satisfies TemplateEntry

export default Email
