import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { prenom?: string; titre?: string; date?: string; ctaUrl?: string; pieces?: boolean; contrat?: boolean }

const Email = ({ prenom, titre, date, ctaUrl, pieces, contrat }: Props) => (
  <LigneoEmailShell
    preview="Votre document a bien été signé."
    tagline="Signature électronique"
    title="Document signé"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={pieces
      ? (contrat
        ? "Merci, votre contrat de partenariat est signé. Vous trouverez en pièces jointes votre exemplaire signé (PDF, avec le certificat de signature) et le dossier de preuve. Conservez-les : vous les retrouvez aussi à tout moment dans votre espace convoyeur, rubrique Documents."
        : "Merci, votre signature a bien été enregistrée. Vous trouverez en pièces jointes votre exemplaire signé (PDF, avec le certificat de signature) et le dossier de preuve.")
      : "Merci, votre signature a bien été enregistrée. Vous pouvez télécharger votre exemplaire signé et son certificat à tout moment depuis le lien ci-dessous."}
    primaryCta={ctaUrl ? { label: 'Télécharger mon exemplaire signé', href: ctaUrl } : null}
    footnote="Conservez ce document. Son authenticité peut être vérifiée sur transportsligneo.fr/verifier-signature."
  >
    <SimpleCard title={titre ?? 'Document'} subtitle={date ? `Signé le ${date}` : ''} />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Document signé : ${d.titre ?? ''} — Transports Ligneo`,
  displayName: 'Signature — confirmation au signataire',
  previewData: { prenom: 'Morgane', titre: 'Contrat de partenariat', date: '23 octobre 2026 à 10:42', ctaUrl: 'https://transportsligneo.fr/signature/xxxx' },
} satisfies TemplateEntry
