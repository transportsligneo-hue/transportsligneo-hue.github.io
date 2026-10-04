import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { nom?: string; societe?: string; email?: string; telephone?: string }

const Email = ({ nom, societe, email, telephone }: Props) => (
  <LigneoEmailShell
    preview={`Nouvelle demande de démo : ${societe || ''}`}
    tagline="Demande de démo"
    title="Nouvelle demande de démonstration"
    greeting="Bonjour,"
    intro={`${nom || 'Un prospect'} (${societe || 'société non précisée'}) souhaite découvrir l'espace professionnel. Envoyez-lui son accès depuis l'admin, rubrique « Accès démo ».`}
    primaryCta={{ label: "Ouvrir l'admin", href: 'https://transportsligneo.fr/admin/acces-demo' }}
  >
    <SimpleCard title={email || '—'} subtitle={telephone ? `Téléphone : ${telephone}` : 'Téléphone non renseigné'} />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Demande de démo — ${d.societe || 'nouveau prospect'}`,
  displayName: 'Demande de démo (admin)',
  to: 'contact@transportsligneo.fr',
  previewData: { nom: 'Marie Dupont', societe: 'Exemple SAS', email: 'marie@exemple.fr', telephone: '06 00 00 00 00' },
} satisfies TemplateEntry

export default Email
