import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Transports Ligneo'

interface OffreRefuseeProps {
  prenom?: string
  depart?: string
  arrivee?: string
  date?: string
  prixPropose?: number
}

const OffreRefuseeEmail = ({ prenom, depart, arrivee, date, prixPropose }: OffreRefuseeProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre offre n'a pas été retenue — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Convoyage automobile premium</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Bonjour {prenom || ''},</Heading>
        <Text style={text}>
          Votre offre pour la mission ci-dessous n'a pas été retenue cette fois-ci.
        </Text>
        <Section style={card}>
          <Text style={cardLine}><strong>Trajet :</strong> {depart ?? '—'} → {arrivee ?? '—'}</Text>
          <Text style={cardLine}><strong>Date :</strong> {date ?? '—'}</Text>
          <Text style={cardLine}><strong>Votre offre :</strong> {prixPropose != null ? `${prixPropose} €` : '—'}</Text>
        </Section>
        <Text style={text}>
          De nouvelles missions sont publiées régulièrement, n'hésitez pas à proposer
          d'autres prix sur les missions disponibles dans votre espace convoyeur.
        </Text>
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OffreRefuseeEmail,
  subject: 'Votre offre n\'a pas été retenue',
  displayName: 'Offre convoyeur refusée',
  previewData: { prenom: 'Marc', depart: 'Tours', arrivee: 'Paris', date: '02/05/2026', prixPropose: 280 },
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
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
