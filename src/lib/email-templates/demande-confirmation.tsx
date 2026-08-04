import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard, RecapCard } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  depart?: string
  arrivee?: string
  vehicule?: string
  dateSouhaitee?: string
  prestation?: string
}

const Email = ({ prenom, numero, depart, arrivee, vehicule, dateSouhaitee, prestation }: Props) => {
  const rows = [
    vehicule && { label: 'Véhicule', value: vehicule },
    dateSouhaitee && { label: 'Date souhaitée', value: dateSouhaitee },
    prestation && { label: 'Type de prestation', value: prestation },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[]

  return (
    <LigneoEmailShell
      preview="Nous revenons vers vous rapidement."
      tagline="Demande reçue"
      title="Merci, votre demande est bien enregistrée"
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      primaryCta={{ label: 'Suivre ma demande', href: 'https://transportsligneo.fr/dashboard-client' }}
    >
      <SimpleCard
        title={depart && arrivee ? `${depart} → ${arrivee}` : 'Demande de convoyage'}
        subtitle={numero ? `Référence ${numero}` : undefined}
      />
      {rows.length ? <RecapCard rows={rows} /> : null}
      <p style={{ fontSize: 14, lineHeight: 1.65, color: '#4b5468', margin: '0 0 16px' }}>
        Notre équipe traite votre demande et revient vers vous avec un devis dans les meilleurs délais.
      </p>
    </LigneoEmailShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Votre demande a bien été reçue${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Demande — confirmation',
  previewData: {
    prenom: 'Morgane', numero: 'DEM-TLG-2026-114', depart: '6 rue du pont libert, La Riche', arrivee: 'Le Mans',
    vehicule: 'Berline', dateSouhaitee: '20/06/2026', prestation: 'Livraison simple',
  },
} satisfies TemplateEntry
