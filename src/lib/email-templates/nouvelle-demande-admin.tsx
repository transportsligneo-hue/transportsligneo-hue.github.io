import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard } from './_ligneo-header'

interface Props {
  numero?: string
  client?: string
  email?: string
  telephone?: string
  depart?: string
  arrivee?: string
  vehicule?: string
  date?: string
  prestation?: string
}

const Email = ({ numero, client, email, telephone, depart, arrivee, vehicule, date, prestation }: Props) => (
  <LigneoEmailShell
    preview={`Nouvelle demande de devis${numero ? ` — ${numero}` : ''}`}
    tagline="Nouvelle demande"
    icon="📄"
    title="Nouvelle demande de devis"
    greeting="Bonjour,"
    intro="Une nouvelle demande de devis vient d'être enregistrée sur la plateforme."
    primaryCta={{ label: 'Traiter la demande', href: 'https://transportsligneo.fr/admin/demandes' }}
  >
    <RecapCard
      title="Détails de la demande"
      rows={[
        numero && { label: 'Référence', value: numero },
        client && { label: 'Client', value: client },
        email && { label: 'Email', value: email },
        telephone && { label: 'Téléphone', value: telephone },
        depart && { label: 'Départ', value: depart },
        arrivee && { label: 'Arrivée', value: arrivee },
        vehicule && { label: 'Véhicule', value: vehicule },
        date && { label: 'Date souhaitée', value: date },
        prestation && { label: 'Prestation', value: prestation },
      ].filter(Boolean) as any}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[ADMIN] Nouvelle demande${d.numero ? ` — ${d.numero}` : ''}`,
  displayName: 'Admin — nouvelle demande',
  previewData: {
    numero: 'DEV-2026-0001', client: 'Jean Dupont', email: 'jean@example.com', telephone: '06 12 34 56 78',
    depart: 'TOURS (37)', arrivee: 'LE MANS (72)', vehicule: 'Berline', date: '20/06/2026', prestation: 'Aller / Retour',
  },
} satisfies TemplateEntry
