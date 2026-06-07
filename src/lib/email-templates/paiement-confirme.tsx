import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; montant?: number | string }

const Email = ({ prenom, numero, montant }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Paiement confirmé — Transports Ligneo</Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader tagline="Paiement confirmé" />
        <Hr style={divider} />
        <Heading style={h1}>{prenom ? `Merci ${prenom},` : 'Merci,'}</Heading>
        <Text style={text}>Nous confirmons la bonne réception de votre paiement{numero ? ` pour la commande n° ${numero}` : ''}{montant ? ` d'un montant de ${montant} € TTC` : ''}.</Text>
        <Section style={box}>
          <Text style={boxLabel}>STATUT</Text>
          <Text style={boxValue}>✓ Paiement validé</Text>
        </Section>
        <Text style={text}>Votre facture sera disponible dans votre espace client. Notre équipe organise dès à présent votre mission.</Text>
        <Text style={footer}>L'équipe Transports Ligneo</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Paiement confirmé${d.numero ? ` — n° ${d.numero}` : ''} — Transports Ligneo`,
  displayName: 'Paiement confirmé',
  previewData: { prenom: 'Jean', numero: 'FAC-TLG-2026-001', montant: 237 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 16px' }
const box = { backgroundColor: '#0b1026', border: '2px solid #d4af37', borderRadius: '4px', padding: '18px', margin: '12px 0 18px', textAlign: 'center' as const }
const boxLabel = { fontSize: '11px', color: '#e7c76a', letterSpacing: '2px', margin: '0 0 6px' }
const boxValue = { fontSize: '20px', color: '#d4af37', margin: '0', fontWeight: 'bold' as const }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
