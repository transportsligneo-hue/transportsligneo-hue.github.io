import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

interface Props { prenom?: string; numero?: string }

const Email = ({ prenom, numero }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre mission est terminée — Transports Ligneo</Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader tagline="Mission terminée" />
        <Hr style={divider} />
        <Heading style={h1}>{prenom ? `Bonjour ${prenom},` : 'Bonjour,'}</Heading>
        <Text style={text}>Votre mission{numero ? ` n° ${numero}` : ''} est désormais terminée. Le procès-verbal de livraison et les photos d'état des lieux sont disponibles dans votre espace client.</Text>
        <Text style={text}>Votre facture vous parviendra par email séparé dans les meilleurs délais.</Text>
        <Text style={text}>Merci de votre confiance.</Text>
        <Text style={footer}>L'équipe Transports Ligneo</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Mission terminée${d.numero ? ` — n° ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Mission terminée (client)',
  previewData: { prenom: 'Jean', numero: 'MIS-TLG-2026-001' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 16px' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
