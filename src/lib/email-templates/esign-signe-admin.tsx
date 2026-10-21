import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, SimpleCard } from './_ligneo-header'

interface Props { signataire?: string; titre?: string; type?: string; refus?: boolean; motif?: string }

const Email = ({ signataire, titre, refus, motif }: Props) => (
  <LigneoEmailShell
    preview={refus ? 'Un document a été refusé.' : 'Un document vient d\'être signé.'}
    tagline="Signature électronique"
    taglineTone={refus ? 'warn' : 'blue'}
    title={refus ? 'Document refusé' : 'Document signé'}
    intro={refus ? `${signataire ?? 'Le signataire'} a refusé de signer.${motif ? ` Motif : ${motif}` : ''}` : `${signataire ?? 'Le signataire'} vient de signer le document. Le dossier de preuve est disponible dans l'espace admin, rubrique Signatures.`}
    primaryCta={{ label: 'Ouvrir les signatures', href: 'https://transportsligneo.fr/admin/signatures' }}
  >
    <SimpleCard title={titre ?? 'Document'} subtitle={signataire ?? ''} />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${d.refus ? 'Signature refusée' : 'Signature reçue'} : ${d.titre ?? ''}`,
  displayName: 'Signature — notification admin',
  previewData: { signataire: 'Morgane Dupont', titre: 'Contrat de partenariat', type: 'contrat_convoyeur' },
} satisfies TemplateEntry
