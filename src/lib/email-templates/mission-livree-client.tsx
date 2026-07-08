import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; convoyeur?: string; heureLivraison?: string; kilometrage?: string; lieu?: string }

const Email = ({ prenom, numero, convoyeur, heureLivraison, kilometrage, lieu }: Props) => (
  <LigneoEmailShell
    preview="Livraison terminée — Transports Ligneo"
    tagline="Livraison terminée"
    icon="✓"
    title="Livraison terminée"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Votre véhicule a été livré avec succès. Merci de votre confiance."
    primaryCta={{ label: 'Télécharger tous les documents', href: 'https://transportsligneo.fr/dashboard-client/documents' }}
    secondaryCta={{ label: 'Télécharger la facture', href: 'https://transportsligneo.fr/dashboard-client/documents' }}
  >
    <RecapCard
      rows={[
        heureLivraison && { label: 'Date de livraison', value: heureLivraison },
        kilometrage && { label: 'Kilométrage', value: kilometrage },
        lieu && { label: 'Lieu de livraison', value: lieu },
        convoyeur && { label: 'Convoyeur', value: convoyeur },
        numero && { label: 'N° de mission', value: numero },
      ].filter(Boolean) as any}
    />
    <HighlightBox label="Mission terminée" value="Merci pour votre confiance." tone="success" />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Livraison terminée${d.numero ? ` — ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Mission livrée (client)',
  previewData: { prenom: 'Jean', numero: 'MIS-2026-0001', convoyeur: 'Thomas D.', heureLivraison: '20/06/2026 12:40', kilometrage: '15 842 km', lieu: 'LE MANS (72)' },
} satisfies TemplateEntry
