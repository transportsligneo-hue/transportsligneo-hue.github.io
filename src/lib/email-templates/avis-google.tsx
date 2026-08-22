import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  depart?: string
  arrivee?: string
  reviewUrl?: string
  isContactLivraison?: boolean
}

const Email = ({ prenom, numero, depart, arrivee, reviewUrl, isContactLivraison }: Props) => (
  <LigneoEmailShell
    preview="Votre avis compte — 30 secondes suffisent"
    tagline="Merci pour votre confiance"
    title="Comment s'est passé votre convoyage ?"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={
      isContactLivraison
        ? `Vous avez réceptionné un véhicule livré par Transports Ligneo. Si tout s'est bien passé, un avis Google nous aiderait énormément — cela prend moins de 30 secondes.`
        : `Votre véhicule a bien été livré. Si vous êtes satisfait de la prestation, un avis Google nous aiderait énormément — cela prend moins de 30 secondes.`
    }
    primaryCta={reviewUrl ? { label: 'Laisser un avis Google', href: reviewUrl } : null}
    footnote="Un souci ou une remarque ? Répondez simplement à cet email, nous vous répondons sous 24h."
  >
    <SimpleCard
      title={depart && arrivee ? `${depart} → ${arrivee}` : 'Convoyage terminé'}
      subtitle={numero ? `Référence ${numero}` : ''}
    />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Votre avis sur notre convoyage${d.numero ? ` — n° ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Demande d’avis Google',
  previewData: {
    prenom: 'Morgane',
    numero: 'MIS-TLG-2026-114',
    depart: 'La Riche',
    arrivee: 'Tours',
    reviewUrl: 'https://g.page/r/example/review',
  },
} satisfies TemplateEntry
