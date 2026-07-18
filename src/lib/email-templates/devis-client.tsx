import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

interface Props {
  prenom?: string
  nom?: string
  numero?: string
  depart?: string
  arrivee?: string
  distance?: number | string
  prix?: number | string
  optionTrajet?: string
  clientLogoUrl?: string
  clientName?: string
}

const Email = ({ prenom, numero, depart, arrivee, distance, prix, optionTrajet, clientLogoUrl, clientName }: Props) => {
  const rows = [
    depart && arrivee && { label: `${depart} → ${arrivee}`, value: prix ? `${prix} €` : '' },
    distance && { label: 'Distance', value: `${distance} km` },
    optionTrajet && { label: 'Option', value: optionTrajet },
    numero && { label: 'Référence', value: numero },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[]

  return (
    <LigneoEmailShell
      preview={`Votre devis ${numero ?? ''} — Transports Ligneo`}
      tagline="Devis disponible"
      icon="📄"
      title="Devis disponible"
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      intro="Votre devis est prêt. Vous pouvez le consulter en ligne et le signer électroniquement en quelques clics."
      primaryCta={{ label: 'Consulter le devis', href: 'https://transportsligneo.fr/dashboard-client/devis' }}
      secondaryCta={{ label: 'Signer électroniquement', href: 'https://transportsligneo.fr/dashboard-client/devis' }}
      clientLogoUrl={clientLogoUrl}
      clientName={clientName}
    >
      {rows.length ? <RecapCard title="Détail du devis" rows={rows} /> : null}
      {prix ? <HighlightBox label="Total TTC" value={`${prix} €`} meta="Péage et carburant inclus" tone="gold" /> : null}
    </LigneoEmailShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Votre devis ${d.numero ? `n° ${d.numero} ` : ''}— Transports Ligneo`,
  displayName: 'Devis client',
  previewData: {
    prenom: 'Jean', nom: 'Dupont', numero: 'DEV-2026-0001',
    depart: 'TOURS (37)', arrivee: 'LE MANS (72)', distance: 120, prix: 180, optionTrajet: 'Aller / Retour',
  },
} satisfies TemplateEntry
