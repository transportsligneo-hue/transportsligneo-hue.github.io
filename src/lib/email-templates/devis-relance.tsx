import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard, AmountRow } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  depart?: string
  arrivee?: string
  prix?: number | string
  /** Date souhaitée de prise en charge (texte). */
  dateSouhaitee?: string
  /** Lien public tokenisé : signature puis paiement, sans connexion. */
  lien?: string
  /** 'signer' : devis à signer ; 'payer' : signé, reste le paiement. */
  etape?: 'signer' | 'payer'
  /** Mot personnalisé (facultatif). */
  message?: string
}

const Email = ({ prenom, numero, depart, arrivee, prix, dateSouhaitee, lien, etape = 'signer', message }: Props) => {
  const aSigner = etape !== 'payer'
  return (
    <LigneoEmailShell
      preview={aSigner ? `Votre devis${numero ? ` n° ${numero}` : ''} attend votre signature.` : `Il ne reste que le règlement de votre devis${numero ? ` n° ${numero}` : ''}.`}
      tagline="Rappel de votre devis"
      taglineTone="warn"
      title={aSigner ? 'Votre devis attend votre signature' : 'Plus qu’une étape : le règlement'}
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      intro={
        aSigner
          ? 'Nous n’avons pas encore reçu votre accord pour ce convoyage. Pour réserver votre créneau, il suffit de signer le devis en ligne, en 1 minute, sans créer de compte.'
          : 'Votre devis est signé. Il ne reste plus qu’à régler en ligne, en toute sécurité, pour confirmer définitivement votre convoyage.'
      }
      primaryCta={{ label: aSigner ? 'Signer mon devis' : 'Payer mon devis', href: lien || 'https://transportsligneo.fr/dashboard-client/devis' }}
      footnote={
        <>
          {message ? <>{message}<br /><br /></> : null}
          Ce lien est personnel et sécurisé. Une question ? Répondez à ce mail ou appelez-nous au 07 82 45 61 81.
        </>
      }
    >
      <SimpleCard
        title={depart && arrivee ? `${depart} → ${arrivee}` : 'Convoyage automobile'}
        subtitle={[numero && `Référence ${numero}`, dateSouhaitee && `Prise en charge souhaitée : ${dateSouhaitee}`].filter(Boolean).join(' · ')}
      />
      {prix ? <AmountRow amount={`${prix} €`} /> : null}
    </LigneoEmailShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d.etape === 'payer'
      ? `Plus qu'une étape pour votre devis${d.numero ? ` n° ${d.numero}` : ''} — Transports Ligneo`
      : `Rappel : votre devis${d.numero ? ` n° ${d.numero}` : ''} attend votre signature — Transports Ligneo`,
  displayName: 'Relance devis (signature / paiement)',
  previewData: {
    prenom: 'Emmanuel', numero: 'DEV-TLG-2026-152',
    depart: 'Parking gare de Saint-Pierre-des-Corps', arrivee: 'Saint-Maurice-la-Clouère',
    prix: '167,00', dateSouhaitee: '23/10/2026', etape: 'signer',
    lien: 'https://www.transportsligneo.fr/devis/xxxxxxxxxxxx',
  },
} satisfies TemplateEntry
