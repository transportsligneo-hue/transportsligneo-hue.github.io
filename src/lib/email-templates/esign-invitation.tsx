import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { prenom?: string; titre?: string; ctaUrl?: string; jours?: number; relance?: boolean }

const Email = ({ prenom, titre, ctaUrl, jours = 14, relance }: Props) => (
  <LigneoEmailShell
    preview={`Un document attend votre signature : ${titre ?? ''}`}
    tagline="Signature électronique"
    title={relance ? 'Rappel : document à signer' : 'Un document à signer'}
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro="Transports Ligneo vous invite à signer électroniquement le document ci-dessous. La signature se fait en quelques instants depuis votre téléphone ou votre ordinateur."
    primaryCta={ctaUrl ? { label: 'Lire et signer le document', href: ctaUrl } : null}
    footnote={`Ce lien est personnel et valable ${jours} jours. Un code de vérification vous sera demandé avant la signature. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`}
  >
    <SimpleCard title={titre ?? 'Document'} subtitle="Signature électronique sécurisée" />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${d.relance ? 'Rappel · ' : ''}Document à signer : ${d.titre ?? ''} — Transports Ligneo`,
  displayName: 'Signature — invitation',
  previewData: { prenom: 'Morgane', titre: 'Contrat de partenariat convoyeur', ctaUrl: 'https://transportsligneo.fr/signature/xxxx', jours: 14 },
} satisfies TemplateEntry
