import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

interface Props {
  societe?: string
  contact?: string
  email?: string
  telephone?: string
  fonction?: string
  taille?: string
  secteur?: string
  vehicules?: number | string
  delaiDebut?: string
  budget?: string
  message?: string
}

const Email = (p: Props) => (
  <LigneoEmailShell
    preview={`Nouveau lead flotte${p.societe ? ` — ${p.societe}` : ''}`}
    tagline="Prospect flotte"
    icon="🏢"
    title="Nouveau lead flotte B2B"
    greeting="Bonjour,"
    intro="Un prospect vient de soumettre une demande de partenariat flotte. À contacter en priorité."
    primaryCta={{ label: 'Traiter le lead', href: 'https://transportsligneo.fr/admin/b2b-leads' }}
  >
    <HighlightBox
      label="Prospect chaud"
      value={`${p.societe ?? 'Nouveau prospect'} — ${p.vehicules ?? '?'} véhicules`}
      tone="gold"
    />
    <RecapCard
      title="Entreprise"
      rows={[
        p.societe && { label: 'Société', value: p.societe },
        p.secteur && { label: 'Secteur', value: p.secteur },
        p.taille && { label: 'Effectif', value: p.taille },
        p.vehicules && { label: 'Véhicules', value: `${p.vehicules}` },
        p.delaiDebut && { label: 'Délai de démarrage', value: p.delaiDebut },
        p.budget && { label: 'Budget indicatif', value: p.budget },
      ].filter(Boolean) as any}
    />
    <RecapCard
      title="Contact"
      rows={[
        p.contact && { label: 'Nom', value: p.contact },
        p.fonction && { label: 'Fonction', value: p.fonction },
        p.email && { label: 'Email', value: p.email },
        p.telephone && { label: 'Téléphone', value: p.telephone },
        p.message && { label: 'Message', value: p.message },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[LEAD FLOTTE] ${d.societe ?? 'Nouveau prospect'}`,
  displayName: 'Admin — lead flotte',
  previewData: {
    societe: 'ACME Logistique', contact: 'Marie Martin', email: 'm.martin@acme.com',
    telephone: '01 23 45 67 89', fonction: 'DAF', taille: '51-250', secteur: 'Location LLD',
    vehicules: 45, delaiDebut: 'Immédiat', budget: '30-50k€', message: 'Souhaite étudier un partenariat annuel.',
  },
} satisfies TemplateEntry
