import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard, RecapCard } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  trackingCode?: string
  depart?: string
  arrivee?: string
  date?: string
  prestation?: string
  prix?: number | string
  convoyeur?: string
  clientLogoUrl?: string
  clientName?: string
}

const Email = ({ prenom, numero, trackingCode, depart, arrivee, date, prestation, prix, convoyeur, clientLogoUrl, clientName }: Props) => (
  <LigneoEmailShell
    preview={convoyeur ? `Votre convoyeur ${convoyeur} a été attribué.` : 'Votre convoyage est planifié.'}
    tagline="Mission confirmée"
    title="Votre convoyage est planifié"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Bonne nouvelle : votre mission a été attribuée à l'un de nos convoyeurs validés."
    primaryCta={{ label: 'Suivre ma mission en direct', href: 'https://transportsligneo.fr/suivi' }}
    clientLogoUrl={clientLogoUrl}
    clientName={clientName}
    footnote="Vous recevrez une notification dès le départ du convoyeur, puis à chaque étape clé de la mission."
  >
    <SimpleCard
      title={depart && arrivee ? `${depart} → ${arrivee}` : 'Convoyage automobile'}
      subtitle={[numero ? `Référence ${numero}` : null, date, prestation].filter(Boolean).join(' · ')}
    />
    {(numero || trackingCode) ? (
      <RecapCard
        rows={[
          numero && { label: 'Numéro de mission', value: numero },
          trackingCode && { label: 'Code confidentiel', value: trackingCode },
        ].filter(Boolean) as any}
      />
    ) : null}
    {(convoyeur || prix) ? (
      <RecapCard
        rows={[
          convoyeur && { label: 'Convoyeur', value: convoyeur },
          prix && { label: 'Montant TTC', value: `${prix} €` },
        ].filter(Boolean) as any}
      />
    ) : null}
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Mission confirmée${d.numero ? ` — ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Mission — confirmation',
  previewData: {
    prenom: 'Morgane', numero: 'MIS-TLG-2026-114', trackingCode: 'A7K9P2', depart: '6 rue du pont libert, La Riche',
    arrivee: '37 Rue Édouard Vaillant, Tours', date: '15/08/2026 · 10:00', prestation: 'Livraison simple',
    prix: 120, convoyeur: 'Olivier G.',
  },
} satisfies TemplateEntry

