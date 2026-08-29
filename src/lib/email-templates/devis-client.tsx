import * as React from 'react'
import { Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard, AmountRow } from './_ligneo-header'

interface Props {
  /** Lien avis Google (optionnel, sinon lien par défaut). */
  avisUrl?: string
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
  /** Mot personnalisé rédigé par l'équipe Ligneo. */
  message?: string
  /** Lien de téléchargement direct du devis PDF (URL signée). */
  pdfUrl?: string
  /** Lien public tokenisé permettant de signer le devis (code SMS/email). */
  signUrl?: string
  /** Lien de paiement sécurisé (Stripe) sans connexion préalable. */
  payUrl?: string
}

const Email = ({ avisUrl, prenom, numero, depart, arrivee, distance, prix, optionTrajet, clientLogoUrl, clientName, message, pdfUrl, signUrl, payUrl }: Props) => (
  <LigneoEmailShell
    googleReview={avisUrl || true}
    preview={`Devis ${prix ? `${prix} € ` : ''}— valable 15 jours.`}
    tagline="Devis instantané"
    title="Votre devis est prêt"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Voici le récapitulatif de votre demande de convoyage. Ce devis est valable 15 jours à compter d'aujourd'hui."

    primaryCta={
      signUrl
        ? { label: 'Accepter et signer le devis', href: signUrl }
        : pdfUrl
          ? { label: 'Télécharger mon devis (PDF)', href: pdfUrl }
          : { label: 'Confirmer ma mission', href: 'https://transportsligneo.fr/dashboard-client/devis' }
    }
    secondaryCta={
      signUrl && pdfUrl
        ? { label: 'Télécharger mon devis (PDF)', href: pdfUrl }
        : payUrl
          ? { label: 'Payer en ligne en sécurité', href: payUrl }
          : pdfUrl
            ? { label: 'Confirmer ma mission', href: 'https://transportsligneo.fr/dashboard-client/devis' }
            : null
    }

    clientLogoUrl={clientLogoUrl}
    clientName={clientName}
    footnote="Ce prix inclut l'assurance tous risques, les péages et le suivi GPS en temps réel."
  >

    {message ? (
      <Section
        style={{
          backgroundColor: '#f5f7fc',
          border: '1px solid #dbe3f5',
          borderLeft: '3px solid #2F5FFF',
          borderRadius: '12px',
          padding: '16px 20px',
          margin: '0 0 20px',
        }}
      >
        <Text
          style={{
            fontFamily: "'Poppins','Helvetica Neue',Arial,sans-serif",
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#1c3fc4',
            margin: '0 0 6px',
          }}
        >
          Message de l'équipe Ligneo
        </Text>
        {String(message)
          .split(/\n+/)
          .filter(Boolean)
          .map((line, i) => (
            <Text
              key={i}
              style={{
                fontFamily: "'Poppins','Helvetica Neue',Arial,sans-serif",
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#2c3550',
                margin: i === 0 ? 0 : '8px 0 0',
              }}
            >
              {line}
            </Text>
          ))}
      </Section>
    ) : null}

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
