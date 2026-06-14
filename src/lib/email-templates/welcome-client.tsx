import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

interface Props {
  prenom?: string
}

const Email = ({ prenom }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Bienvenue chez Transports Ligneo</Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader tagline="Convoyage automobile" />
        <Hr style={divider} />
        <Heading style={h1}>{prenom ? `Bienvenue ${prenom},` : 'Bienvenue,'}</Heading>
        <Text style={text}>
          Votre compte Transports Ligneo est actif. Vous pouvez dès maintenant
          demander un devis de convoyage en 3 secondes, suivre vos missions en
          temps réel et signer électroniquement vos états des lieux.
        </Text>
        <Section style={card}>
          <Text style={cardLine}><strong>Estimer un trajet :</strong> www.transportsligneo.fr</Text>
          <Text style={cardLine}><strong>Espace client :</strong> www.transportsligneo.fr/auth</Text>
          <Text style={cardLine}><strong>Service client :</strong> 07 82 45 61 81 — 7j/7</Text>
        </Section>
        <Text style={text}>
          Une question ? Répondez à cet email, nous sommes là.
        </Text>
        <Text style={footer}>Cordialement, L'équipe Transports Ligneo</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Bienvenue chez Transports Ligneo',
  displayName: 'Bienvenue client',
  previewData: { prenom: 'Jean' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: '#0b1026', padding: '20px', borderRadius: '6px', margin: '20px 0' }
const cardLine = { fontSize: '13px', color: '#f5f1e8', margin: '6px 0', lineHeight: '1.5' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
