import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, CodeBox } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  code?: string
  depart?: string
  arrivee?: string
  prix?: number | string
  /** minutes de validité, ex "10" */
  validite?: string | number
}

const Email = ({ prenom, numero, code, validite = 10 }: Props) => (
  <LigneoEmailShell
    preview="Code à usage unique pour valider votre devis."
    tagline="Signature électronique"
    title="Votre code de signature"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={`Saisissez ce code pour signer électroniquement votre devis${numero ? ` ${numero}` : ''} :`}
    footnote={`Ce code est valable ${validite} minutes. Ne le partagez avec personne — notre équipe ne vous le demandera jamais.`}
  >
    <CodeBox code={code ?? '------'} />
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Code de signature${d.code ? ` : ${d.code}` : ''} — Transports Ligneo`,
  displayName: 'Devis — code OTP de signature',
  previewData: {
    prenom: 'Morgane',
    numero: 'DEV-TLG-2026-091',
    code: '715240',
    validite: 10,
  },
} satisfies TemplateEntry
