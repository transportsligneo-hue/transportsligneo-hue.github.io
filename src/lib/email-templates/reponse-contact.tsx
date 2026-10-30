import * as React from 'react'
import { Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell } from './_ligneo-header'

interface Props {
  prenom?: string
  subject?: string
  message?: string
  originalMessage?: string
  originalDate?: string
}

const bodyText: React.CSSProperties = {
  fontFamily: "'Inter', 'Segoe UI', Arial, Helvetica, sans-serif",
  fontSize: '15px',
  lineHeight: '1.65',
  color: '#1c2438',
  margin: '0 0 12px',
}

const quoteBox: React.CSSProperties = {
  margin: '22px 0 8px',
  padding: '14px 16px',
  backgroundColor: '#f7f9fc',
  borderLeft: '3px solid #2f5fff',
  borderRadius: '6px',
}

const quoteLabel: React.CSSProperties = {
  fontFamily: "'Inter', 'Segoe UI', Arial, Helvetica, sans-serif",
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#8a93aa',
  margin: '0 0 6px',
}

const quoteText: React.CSSProperties = {
  fontFamily: "'Inter', 'Segoe UI', Arial, Helvetica, sans-serif",
  fontSize: '13px',
  lineHeight: '1.55',
  color: '#6b7389',
  margin: 0,
}

function Paragraphs({ text, style }: { text: string; style: React.CSSProperties }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).filter((b) => b.trim())
  return (
    <>
      {blocks.map((block, i) => (
        <Text key={i} style={style}>
          {block.split('\n').map((line, j) => (
            <React.Fragment key={j}>
              {j > 0 ? <br /> : null}
              {line}
            </React.Fragment>
          ))}
        </Text>
      ))}
    </>
  )
}

/** Réponse de l'équipe à une demande de contact : message lisible, citation de la demande d'origine, réponse possible directement par mail. */
const Email = ({ prenom, subject, message, originalMessage, originalDate }: Props) => (
  <LigneoEmailShell
    preview={(message || 'Réponse de notre équipe à votre demande.').slice(0, 110)}
    tagline="Réponse à votre demande"
    title={subject || 'Réponse à votre demande'}
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    footnote="Vous pouvez répondre directement à cet email, votre message nous parviendra."
  >
    <Section style={{ margin: '0 0 6px' }}>
      <Paragraphs text={message || ''} style={bodyText} />
    </Section>
    {originalMessage ? (
      <Section style={quoteBox}>
        <Text style={quoteLabel}>Votre demande{originalDate ? ` du ${originalDate}` : ''}</Text>
        <Paragraphs text={originalMessage} style={quoteText} />
      </Section>
    ) : null}
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (data) => data.subject || 'Réponse de Transports Ligneo',
  displayName: 'Réponse à une demande de contact',
  previewData: {
    prenom: 'Morgane',
    subject: 'Re : votre demande de convoyage',
    message: "Merci pour votre message.\n\nNous pouvons prendre en charge ce convoyage dès la semaine prochaine. Pouvez-vous nous confirmer l'adresse de départ ?",
    originalMessage: 'Bonjour, je souhaite faire convoyer un véhicule de Tours à Lyon.',
    originalDate: '21/10/2026',
  },
} satisfies TemplateEntry
