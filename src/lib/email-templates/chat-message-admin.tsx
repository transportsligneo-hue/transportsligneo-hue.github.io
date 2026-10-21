import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, SimpleCard } from './_ligneo-header'

interface Props {
  role?: string // Client | Convoyeur | Visiteur
  expediteur?: string
  reference?: string
  trajet?: string
  vehicule?: string
  message?: string
  ctaUrl?: string
}

const Email = ({ role, expediteur, reference, trajet, vehicule, message, ctaUrl }: Props) => {
  const rows = [
    { label: role === 'Convoyeur' ? 'Convoyeur' : role === 'Visiteur' ? 'Visiteur' : 'Client', value: expediteur || '—' },
    ...(reference ? [{ label: 'Mission', value: reference }] : []),
    ...(trajet ? [{ label: 'Trajet', value: trajet }] : []),
    ...(vehicule ? [{ label: 'Véhicule', value: vehicule }] : []),
  ]
  return (
    <LigneoEmailShell
      preview={`${role ?? 'Nouveau message'} ${expediteur ?? ''} : ${(message ?? '').slice(0, 80)}`}
      tagline={`Chat · ${role ?? 'Message'}`}
      title={`Message de ${expediteur || role || 'un utilisateur'}`}
      primaryCta={ctaUrl ? { label: 'Ouvrir la conversation', href: ctaUrl } : null}
    >
      <RecapCard rows={rows} />
      <SimpleCard title="Message" subtitle={message || 'Pièce jointe'} />
    </LigneoEmailShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `${d.role === 'Convoyeur' ? '🚚' : '👤'} ${d.role ?? 'Message'} ${d.expediteur ?? ''}${d.reference ? ` · ${d.reference}` : ''}`.trim(),
  displayName: 'Chat — message reçu (admin)',
  previewData: {
    role: 'Convoyeur', expediteur: 'Jean Dupont', reference: 'MIS-TLG-2026-#152',
    trajet: 'Tours → Poitiers', vehicule: 'Renault Clio · GR-935-ZW',
    message: 'Bonjour, je suis arrivé sur place mais le client est absent.', ctaUrl: 'https://transportsligneo.fr/admin/messagerie',
  },
} satisfies TemplateEntry
