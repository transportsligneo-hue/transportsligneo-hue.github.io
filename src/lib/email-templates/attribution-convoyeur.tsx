import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; convoyeur?: string; date?: string }

const Email = ({ prenom, numero, convoyeur, date }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Un convoyeur a été assigné à votre mission</Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader tagline="Convoyeur attribué" />
        <Hr style={divider} />
        <Heading style={h1}>{prenom ? `Bonjour ${prenom},` : 'Bonjour,'}</Heading>
        <Text style={text}>Bonne nouvelle : un convoyeur professionnel a été attribué à votre mission{numero ? ` n° ${numero}` : ''}.</Text>
        <Section style={box}>
          <Text style={boxLabel}>CONVOYEUR</Text>
          <Text style={boxValue}>{convoyeur || 'Notre équipe'}</Text>
          {date && <Text style={boxMeta}>Prise en charge : {date}</Text>}
        </Section>
        <Text style={text}>Vous serez tenu informé de l'avancement et recevrez la facture une fois la mission terminée.</Text>
        <Text style={footer}>L'équipe Transports Ligneo</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Convoyeur attribué${d.numero ? ` — mission n° ${d.numero}` : ''}`,
  displayName: 'Attribution convoyeur',
  previewData: { prenom: 'Jean', numero: 'MIS-TLG-2026-001', convoyeur: 'Marc D.', date: '10/06/2026' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 16px' }
const box = { backgroundColor: '#f8f6f0', border: '1px solid #d4af37', borderRadius: '4px', padding: '18px', margin: '12px 0 18px' }
const boxLabel = { fontSize: '10px', color: '#0b1026', letterSpacing: '2px', margin: '0 0 6px', fontWeight: 'bold' as const }
const boxValue = { fontSize: '15px', color: '#0b1026', margin: '0', fontWeight: 'bold' as const }
const boxMeta = { fontSize: '12px', color: '#666', margin: '4px 0 0' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
