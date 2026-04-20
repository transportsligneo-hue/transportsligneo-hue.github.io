import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Transports Ligneo'
const SITE_URL = 'https://transportsligneo.fr'

interface ConvoyeurValidationProps {
  prenom?: string
  nom?: string
}

const ConvoyeurValidationEmail = ({ prenom, nom }: ConvoyeurValidationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre compte convoyeur est validé — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Convoyage automobile premium</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Bienvenue {prenom || ''} {nom || ''} 🎉</Heading>
        <Text style={text}>
          Excellente nouvelle ! Votre compte convoyeur vient d'être <strong>validé</strong> par notre équipe.
        </Text>
        <Text style={text}>
          Vous avez désormais accès à votre espace personnel pour consulter et accepter les missions qui vous sont proposées.
        </Text>
        <Section style={btnWrap}>
          <Button href={`${SITE_URL}/login`} style={btn}>
            Accéder à mon espace
          </Button>
        </Section>
        <Text style={text}>
          Pensez à compléter vos disponibilités et vérifier vos documents depuis votre tableau de bord.
        </Text>
        <Text style={footer}>— L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConvoyeurValidationEmail,
  subject: 'Votre compte convoyeur est validé — Transports Ligneo',
  displayName: 'Validation compte convoyeur',
  previewData: { prenom: 'Jean', nom: 'Dupont' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '20px 0' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#d4af37', letterSpacing: '3px', margin: '0' }
const subtitle = { fontSize: '11px', color: '#0b1026', letterSpacing: '2px', margin: '5px 0 0', textTransform: 'uppercase' as const }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 18px' }
const btnWrap = { textAlign: 'center' as const, margin: '28px 0' }
const btn = { backgroundColor: '#0b1026', color: '#d4af37', padding: '14px 32px', borderRadius: '4px', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' as const, textDecoration: 'none', fontWeight: 'bold' as const }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
