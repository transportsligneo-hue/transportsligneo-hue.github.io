import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; depart?: string; arrivee?: string; dateLivraison?: string; facture?: string }

const Email = ({ prenom, numero, depart, arrivee, dateLivraison, facture }: Props) => (
  <LigneoEmailShell
    preview={`Votre véhicule a été livré.${facture ? ` Facture ${facture} disponible.` : ''}`}
    tagline="Mission terminée"
    title="Votre véhicule a été livré ✓"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Votre mission de convoyage est terminée. L'état des lieux d'arrivée et la facture sont disponibles dans votre espace client."
    primaryCta={{ label: 'Télécharger ma facture', href: 'https://transportsligneo.fr/dashboard-client/documents' }}
    footnote="Merci de votre confiance. Une remarque sur cette mission ? Répondez simplement à cet email."
  >
    <SimpleCard
      title={depart && arrivee ? `${depart} → ${arrivee}` : 'Convoyage terminé'}
      subtitle={[numero ? `Référence ${numero}` : null, dateLivraison ? `Livré le ${dateLivraison}` : null].filter(Boolean).join(' · ')}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Mission terminée${d.numero ? ` — n° ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Mission terminée (client)',
  previewData: {
    prenom: 'Morgane', numero: 'MIS-TLG-2026-114', depart: '6 rue du pont libert, La Riche',
    arrivee: '37 Rue Édouard Vaillant, Tours', dateLivraison: '15/08/2026 à 14:22', facture: 'FAC-TLG-2026-114',
  },
} satisfies TemplateEntry
