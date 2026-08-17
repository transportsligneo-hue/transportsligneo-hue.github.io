import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard, AmountRow } from './_ligneo-header'

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
  /** Lien de téléchargement direct du devis PDF (URL signée). */
  pdfUrl?: string
}

const Email = ({ prenom, numero, depart, arrivee, distance, prix, optionTrajet, clientLogoUrl, clientName, pdfUrl }: Props) => (
  <LigneoEmailShell
    preview={`Devis ${prix ? `${prix} € ` : ''}— valable 15 jours.`}
    tagline="Devis instantané"
    title="Votre devis est prêt"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Voici le récapitulatif de votre demande de convoyage. Ce devis est valable 15 jours à compter d'aujourd'hui."
    primaryCta={
      pdfUrl
        ? { label: 'Télécharger mon devis (PDF)', href: pdfUrl }
        : { label: 'Confirmer ma mission', href: 'https://transportsligneo.fr/dashboard-client/devis' }
    }
    secondaryCta={
      pdfUrl
        ? { label: 'Confirmer ma mission', href: 'https://transportsligneo.fr/dashboard-client/devis' }
        : null
    }
    clientLogoUrl={clientLogoUrl}
    clientName={clientName}
    footnote="Ce prix inclut l'assurance tous risques, les péages et le suivi GPS en temps réel."
  >
    <SimpleCard
      title={depart && arrivee ? `${depart} → ${arrivee}` : 'Convoyage automobile'}
      subtitle={[numero && `Référence ${numero}`, optionTrajet, distance && `${distance} km`].filter(Boolean).join(' · ')}
    />
    {prix ? <AmountRow amount={`${prix} €`} /> : null}
  </LigneoEmailShell>
)


export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Votre devis ${d.numero ? `n° ${d.numero} ` : ''}— Transports Ligneo`,
  displayName: 'Devis client',
  previewData: {
    prenom: 'Morgane', nom: 'Landais', numero: 'DEV-TLG-2026-091',
    depart: '6 rue du pont libert, La Riche', arrivee: '37 Rue Édouard Vaillant, Tours',
    distance: 12, prix: 120, optionTrajet: 'Livraison simple',
  },
} satisfies TemplateEntry
