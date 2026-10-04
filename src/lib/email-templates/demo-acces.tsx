import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { nom?: string; societe?: string; lien: string }

const Email = ({ nom, societe, lien }: Props) => (
  <LigneoEmailShell
    preview="Votre accès privé à la démonstration de l'espace professionnel Ligneo."
    tagline="Accès démonstration"
    title="Votre démo privée est prête"
    greeting={nom ? `Bonjour ${nom},` : 'Bonjour,'}
    intro={`Olivier Gourlaouen vous a ouvert un accès privilégié à la plateforme de pilotage Transports Ligneo${societe ? ` pour ${societe}` : ''}. Aucun mot de passe : cliquez simplement sur le bouton ci-dessous.`}
    primaryCta={{ label: 'Découvrir mon espace démo', href: lien }}
    footnote="Ce lien personnel est valable 7 jours. Pensez à vérifier vos spams si vous ne trouvez pas nos messages."
  >
    <SimpleCard title="Ce que vous allez découvrir" subtitle="Indicateurs en temps réel, missions en cours, suivi des dépenses et délais respectés." />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: 'Votre accès démo à l’espace professionnel — Transports Ligneo',
  displayName: 'Accès démo pro',
  previewData: { nom: 'Marie', societe: 'Exemple SAS', lien: 'https://transportsligneo.fr/demo-pro?token=abc' },
} satisfies TemplateEntry

export default Email
