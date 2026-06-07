import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; montant?: number | string; echeance?: string }

const Email = ({ prenom, numero, montant, echeance }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre facture est disponible</Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader tagline="Nouvelle facture" />
        <Hr style={divider} />
        <Heading style={h1}>{prenom ? `Bonjour ${prenom},` : 'Bonjour,'}</Heading>
        <Text style={text}>Votre facture{numero ? ` n° ${numero}` : ''} est disponible dans votre espace client.</Text>
        <Section style={box}>
          <Text style={boxLabel}>MONTANT</Text>
          <Text style={boxValue}>{montant ? `${montant} €` : '—'}</Text>
          {echeance && <Text style={boxMeta}>Échéance : {echeance}</Text>}
        </Section>
        <Text style={text}>Merci de votre confiance.</Text>
        <Text style={footer}>L'équipe Transports Ligneo</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Facture${d.numero ? ` n° ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Facture disponible',
  previewData: { prenom: 'Jean', numero: 'FAC-TLG-2026-001', montant: 237, echeance: '30/06/2026' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 16px' }
const box = { backgroundColor: '#0b1026', border: '2px solid #d4af37', borderRadius: '4px', padding: '18px', margin: '12px 0 18px', textAlign: 'center' as const }
const boxLabel = { fontSize: '11px', color: '#e7c76a', letterSpacing: '2px', margin: '0 0 6px' }
const boxValue = { fontSize: '28px', color: '#d4af37', margin: '0', fontWeight: 'bold' as const }
const boxMeta = { fontSize: '11px', color: '#cccccc', margin: '6px 0 0' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
