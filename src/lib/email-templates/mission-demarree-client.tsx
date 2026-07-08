import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; convoyeur?: string; heureDepart?: string; eta?: string }

const Email = ({ prenom, numero, convoyeur, heureDepart, eta }: Props) => (
  <LigneoEmailShell
    preview="Départ effectué — Suivi en temps réel"
    tagline="En cours de convoyage"
    icon="🚗"
    title="Départ effectué"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Le départ de votre véhicule vient d'être effectué. Vous pouvez suivre la mission en temps réel depuis votre espace client."
    primaryCta={{ label: 'Suivre en temps réel', href: 'https://transportsligneo.fr/dashboard-client/missions' }}
  >
    <RecapCard
      rows={[
        { label: 'Statut', value: 'En cours de convoyage' },
        convoyeur && { label: 'Convoyeur', value: convoyeur },
        heureDepart && { label: 'Heure de départ', value: heureDepart },
        eta && { label: 'Heure estimée d\'arrivée', value: eta },
        numero && { label: 'N° de mission', value: numero },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Départ effectué${d.numero ? ` — ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Mission démarrée (client)',
  previewData: { prenom: 'Jean', numero: 'MIS-2026-0001', convoyeur: 'Thomas D.', heureDepart: '20/06/2026 09:15', eta: '20/06/2026 12:45' },
} satisfies TemplateEntry
