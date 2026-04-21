import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Transports Ligneo'

interface OffreAccepteeProps {
  prenom?: string
  depart?: string
  arrivee?: string
  date?: string
  prixPropose?: number
}

const OffreAccepteeEmail = ({ prenom, depart, arrivee, date, prixPropose }: OffreAccepteeProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre offre a été acceptée — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Convoyage automobile premium</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Bonne nouvelle {prenom || ''} ! 🎉</Heading>
        <Text style={text}>
          Votre offre a été <strong>acceptée</strong>. Vous êtes attribué à la mission ci-dessous.
        </Text>
        <Section style={card}>
          <Text style={cardLine}><strong>Trajet :</strong> {depart ?? '—'} → {arrivee ?? '—'}</Text>
          <Text style={cardLine}><strong>Date :</strong> {date ?? '—'}</Text>
          <Text style={cardPrice}><strong>Tarif convenu :</strong> {prixPropose != null ? `${prixPropose} €` : '—'}</Text>
        </Section>
        <Text style={text}>
          Connectez-vous à votre espace convoyeur pour démarrer la mission, suivre l'inspection
          et activer le GPS le moment venu.
        </Text>
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OffreAccepteeEmail,
  subject: 'Offre acceptée — mission attribuée',
  displayName: 'Offre convoyeur acceptée',
  previewData: { prenom: 'Marc', depart: 'Tours', arrivee: 'Paris', date: '02/05/2026', prixPropose: 220 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '20px 0' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#d4af37', letterSpacing: '3px', margin: '0' }
const subtitle = { fontSize: '11px', color: '#0b1026', letterSpacing: '2px', margin: '5px 0 0', textTransform: 'uppercase' as const }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: '#0b1026', padding: '20px', borderRadius: '6px', margin: '20px 0' }
const cardLine = { fontSize: '13px', color: '#f5f1e8', margin: '6px 0', lineHeight: '1.5' }
const cardPrice = { fontSize: '15px', color: '#d4af37', margin: '14px 0 0', borderTop: '1px solid rgba(212,175,55,0.3)', paddingTop: '12px' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
