import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { prenom?: string; clientLogoUrl?: string; clientName?: string }

const Email = ({ prenom, clientLogoUrl, clientName }: Props) => (
  <LigneoEmailShell
    preview="Votre compte est prêt — estimez votre premier convoyage en 30 secondes."
    tagline="Compte créé"
    title={prenom ? `Bienvenue, ${prenom} 👋` : 'Bienvenue 👋'}
    intro="Votre compte Transports Ligneo est activé. Vous pouvez dès maintenant estimer un trajet, réserver un convoyage et suivre vos missions en temps réel depuis votre espace client."
    primaryCta={{ label: 'Accéder à mon espace', href: 'https://transportsligneo.fr/dashboard-client' }}
    clientLogoUrl={clientLogoUrl}
    clientName={clientName}
    footnote="Une question ? Notre équipe est joignable au 07 82 45 61 81 ou par email, du lundi au samedi."
  >
    <SimpleCard
      title="Prochaine étape"
      subtitle="Faites votre premier devis instantané — réponse en moins de 30 secondes, sans engagement."
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: 'Bienvenue chez Transports Ligneo',
  displayName: 'Bienvenue (client)',
  previewData: { prenom: 'Morgane' },
} satisfies TemplateEntry
