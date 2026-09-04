import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox } from './_ligneo-header'

interface AlertLine {
  vehicule?: string
  immatriculation?: string
  type?: string
  detail?: string
  severite?: string
}

interface Props {
  prenom?: string
  societe?: string
  alertes?: AlertLine[]
  clientLogoUrl?: string
  clientName?: string
}

const Email = ({ prenom, societe, alertes = [], clientLogoUrl, clientName }: Props) => {
  const critiques = alertes.filter((a) => a.severite === 'critique').length
  return (
    <LigneoEmailShell
      preview={`${alertes.length} alerte${alertes.length > 1 ? 's' : ''} sur votre parc`}
      tagline="⚠ Alerte flotte"
      taglineTone="warn"
      title="Alertes de votre parc véhicules"
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      intro={`Voici le point quotidien sur votre parc${societe ? ` (${societe})` : ''} : échéances de contrôle, révisions dues, contrats arrivant à terme et véhicules dont le coût au kilomètre s'écarte de la moyenne.`}
      primaryCta={{ label: 'Ouvrir le tableau de bord TCO', href: 'https://transportsligneo.fr/dashboard-pro/tco' }}
      clientLogoUrl={clientLogoUrl}
      clientName={clientName}
    >
      <HighlightBox
        label={critiques > 0 ? 'Alertes critiques' : 'Alertes actives'}
        value={`${critiques > 0 ? critiques : alertes.length} alerte${(critiques > 0 ? critiques : alertes.length) > 1 ? 's' : ''}`}
        tone={critiques > 0 ? 'danger' : 'gold'}
      />
      {alertes.map((a, i) => (
        <RecapCard
          key={i}
          rows={[
            (a.vehicule || a.immatriculation) && {
              label: 'Véhicule',
              value: [a.vehicule, a.immatriculation].filter(Boolean).join(' · '),
            },
            a.type && { label: 'Alerte', value: a.type },
            a.detail && { label: 'Détail', value: a.detail },
          ].filter(Boolean) as any}
        />
      ))}
    </LigneoEmailShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Alertes parc véhicules${Array.isArray(d.alertes) && d.alertes.length ? ` (${d.alertes.length})` : ''} — Transports Ligneo`,
  displayName: 'Alerte flotte — TCO & échéances',
  previewData: {
    prenom: 'Camille',
    societe: 'Flotte Demo',
    alertes: [
      { vehicule: 'Renault Clio', immatriculation: 'AA-123-BB', type: 'Contrôle technique', detail: 'Échéance le 12/09/2026', severite: 'haute' },
      { vehicule: 'Peugeot 208', immatriculation: 'CC-456-DD', type: 'Coût au km élevé', detail: '0,62 €/km contre 0,41 €/km en moyenne', severite: 'critique' },
    ],
  },
} satisfies TemplateEntry
