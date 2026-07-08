import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, HighlightBox } from './_ligneo-header'

interface Props { prenom?: string; numero?: string }

const Email = ({ prenom, numero }: Props) => (
  <LigneoEmailShell
    preview="Votre mission est terminée — Transports Ligneo"
    tagline="Mission terminée"
    icon="🏁"
    title="Mission terminée"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`Votre mission${numero ? ` n° ${numero}` : ''} est désormais terminée. Le procès-verbal de livraison et les photos d'état des lieux sont disponibles dans votre espace client. Votre facture vous parviendra par email séparé dans les meilleurs délais.`}
    primaryCta={{ label: 'Accéder aux documents', href: 'https://transportsligneo.fr/dashboard-client/documents' }}
  >
    <HighlightBox label="Merci pour votre confiance" value="À très bientôt sur Transports Ligneo." tone="success" />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Mission terminée${d.numero ? ` — n° ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Mission terminée (client)',
  previewData: { prenom: 'Jean', numero: 'MIS-2026-0001' },
} satisfies TemplateEntry
