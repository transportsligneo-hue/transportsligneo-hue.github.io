import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, CodeBox } from './_ligneo-header'

interface Props { prenom?: string; titre?: string; code?: string; validite?: string | number }

const Email = ({ prenom, titre, code, validite = 10 }: Props) => (
  <LigneoEmailShell
    preview="Votre code de vérification pour signer."
    tagline="Signature électronique"
    title="Votre code de vérification"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`Saisissez ce code pour signer${titre ? ` « ${titre} »` : ' votre document'} :`}
    footnote={`Ce code est valable ${validite} minutes et ne sert qu'une fois. Ne le partagez avec personne — notre équipe ne vous le demandera jamais.`}
  >
    <CodeBox code={code ?? '------'} />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Code de signature${d.code ? ` : ${d.code}` : ''} — Transports Ligneo`,
  displayName: 'Signature — code de vérification',
  previewData: { prenom: 'Morgane', titre: 'Contrat de partenariat', code: '715240', validite: 10 },
} satisfies TemplateEntry
