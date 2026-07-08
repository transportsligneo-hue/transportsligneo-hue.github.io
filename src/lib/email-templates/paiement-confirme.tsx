import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, HighlightBox } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; montant?: number | string }

const Email = ({ prenom, numero, montant }: Props) => (
  <LigneoEmailShell
    preview="Paiement confirmé — Transports Ligneo"
    tagline="Paiement confirmé"
    icon="💳"
    title="Paiement confirmé"
    greeting={prenom ? `Merci ${prenom},` : 'Merci,'}
    intro={`Nous confirmons la bonne réception de votre paiement${numero ? ` pour la commande n° ${numero}` : ''}${montant ? ` d'un montant de ${montant} € TTC` : ''}.`}
    primaryCta={{ label: 'Accéder à mon espace', href: 'https://transportsligneo.fr/dashboard-client' }}
  >
    <HighlightBox label="Statut" value="✓ Paiement validé" tone="success" />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Paiement confirmé${d.numero ? ` — n° ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Paiement confirmé',
  previewData: { prenom: 'Jean', numero: 'FAC-2026-0001', montant: 180 },
} satisfies TemplateEntry
