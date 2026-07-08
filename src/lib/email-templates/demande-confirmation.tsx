import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

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
    depart && { label: 'Départ', value: depart },
    arrivee && { label: 'Arrivée', value: arrivee },
    vehicule && { label: 'Véhicule', value: vehicule },
    dateSouhaitee && { label: 'Date souhaitée', value: dateSouhaitee },
    prestation && { label: 'Type de prestation', value: prestation },
    numero && { label: 'Référence', value: numero },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[]

  return (
    <LigneoEmailShell
      preview={`Nous avons bien reçu votre demande — ${numero ?? ''}`}
      tagline="Demande enregistrée"
      icon="📄"
      title="Demande de devis reçue"
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      intro="Nous avons bien reçu votre demande de convoyage. Notre plateforme prépare actuellement votre devis, vous serez notifié dès sa disponibilité."
      primaryCta={{ label: 'Suivre ma demande', href: 'https://transportsligneo.fr/dashboard-client' }}
    >
      {rows.length ? <RecapCard title="Récapitulatif" rows={rows} /> : null}
    </LigneoEmailShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Votre demande a bien été reçue${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Demande — confirmation',
  previewData: {
    prenom: 'Jean', numero: 'DEV-2026-0001', depart: 'TOURS (37)', arrivee: 'LE MANS (72)',
    vehicule: 'Berline', dateSouhaitee: '20/06/2026', prestation: 'Aller / Retour',
  },
} satisfies TemplateEntry
