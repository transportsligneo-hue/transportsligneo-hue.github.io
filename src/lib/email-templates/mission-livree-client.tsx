import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; convoyeur?: string; heureLivraison?: string; kilometrage?: string; lieu?: string }

const Email = ({ prenom, numero, convoyeur, heureLivraison, kilometrage, lieu }: Props) => (
  <LigneoEmailShell
    preview="État des lieux d'arrivée disponible."
    tagline="Livré"
    title="Véhicule livré avec succès ✓"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    primaryCta={{ label: "Voir l'état des lieux", href: 'https://transportsligneo.fr/dashboard-client/documents' }}
  >
    <SimpleCard
      title={numero}
      subtitle={[
        heureLivraison ? `Livré le ${heureLivraison}` : 'Livré',
        lieu,
        kilometrage,
        convoyeur,
      ].filter(Boolean).join(' · ')}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Livraison terminée${d.numero ? ` — ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Mission livrée (client)',
  previewData: { prenom: 'Morgane', numero: 'MIS-TLG-2026-114', convoyeur: 'Olivier G.', heureLivraison: '15/08/2026 à 14:22', kilometrage: '15 842 km', lieu: 'Tours (37)' },
} satisfies TemplateEntry
