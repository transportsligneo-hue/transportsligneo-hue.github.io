import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, HighlightBox, RecapCard } from './_ligneo-header'

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

const codeCellStyle: React.CSSProperties = {
  display: 'inline-block',
  minWidth: '38px',
  padding: '10px 4px',
  margin: '0 3px',
  fontFamily: '"Playfair Display", Georgia, serif',
  fontSize: '30px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: '#0b1026',
  background: '#fdfcf8',
  border: '1px solid #d4af37',
  borderRadius: '6px',
  textAlign: 'center',
  lineHeight: '1',
}

const Email = ({ prenom, numero, code, depart, arrivee, prix, validite = 10 }: Props) => {
  const digits = (code ?? '------').padEnd(6, '-').slice(0, 6).split('')
  return (
    <LigneoEmailShell
      preview={`Code de signature ${code ?? ''} — devis ${numero ?? ''}`}
      tagline="Signature électronique"
      icon="🔐"
      title="Votre code de signature"
      greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
      intro={`Voici votre code confidentiel pour signer électroniquement le devis${numero ? ` ${numero}` : ''}. Il est valable ${validite} minutes et ne doit être communiqué à personne.`}
    >
      <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
        {digits.map((d, i) => (
          <span key={i} style={codeCellStyle}>{d}</span>
        ))}
      </div>
      <HighlightBox
        label="Validité"
        value={`Ce code expire dans ${validite} minutes.`}
        tone="warning"
      />
      {(numero || depart || arrivee || prix) && (
        <RecapCard
          rows={[
            numero && { label: 'Devis', value: numero },
            depart && arrivee && { label: 'Trajet', value: `${depart} → ${arrivee}` },
            prix && { label: 'Montant TTC', value: `${prix} €` },
          ].filter(Boolean) as any}
        />
      )}
      <p style={{ fontSize: 12, color: '#6b7280', marginTop: 18, lineHeight: 1.55 }}>
        Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : sans
        saisie du code votre devis reste inchangé. Ne partagez jamais ce code, notre
        équipe ne vous le demandera jamais.
      </p>
    </LigneoEmailShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Code de signature${d.code ? ` : ${d.code}` : ''} — Transports Ligneo`,
  displayName: 'Devis — code OTP de signature',
  previewData: {
    prenom: 'Jean',
    numero: 'DEV-2026-0001',
    code: '482913',
    depart: 'TOURS (37)',
    arrivee: 'BORDEAUX (33)',
    prix: 620,
    validite: 10,
  },
} satisfies TemplateEntry
