import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = "Transports Ligneo"

interface InscriptionConvoyeurProps {
  prenom?: string
  nom?: string
  email?: string
  telephone?: string
  ville?: string
}

const InscriptionConvoyeurEmail = ({ prenom, nom, email, telephone, ville }: InscriptionConvoyeurProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouvelle inscription convoyeur — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Convoyage automobile premium</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Nouvelle inscription convoyeur</Heading>
        <Text style={text}>
          Un nouveau convoyeur vient de s'inscrire sur la plateforme :
        </Text>
        <Section style={infoBox}>
          <Text style={infoLine}><strong>Prénom :</strong> {prenom || '—'}</Text>
          <Text style={infoLine}><strong>Nom :</strong> {nom || '—'}</Text>
          <Text style={infoLine}><strong>Email :</strong> {email || '—'}</Text>
          <Text style={infoLine}><strong>Téléphone :</strong> {telephone || '—'}</Text>
          {ville && <Text style={infoLine}><strong>Ville :</strong> {ville}</Text>}
        </Section>
        <Text style={text}>
          Connectez-vous à l'espace administrateur pour consulter et valider cette inscription.
        </Text>
        <Text style={footer}>— L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InscriptionConvoyeurEmail,
  subject: 'Nouvelle inscription convoyeur — Transports Ligneo',
  displayName: 'Inscription convoyeur (notification admin)',
  previewData: { prenom: 'Jean', nom: 'Dupont', email: 'jean@example.com', telephone: '06 12 34 56 78', ville: 'Tours' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '20px 0' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#d4af37', letterSpacing: '3px', margin: '0' }
const subtitle = { fontSize: '11px', color: '#0b1026', letterSpacing: '2px', margin: '5px 0 0', textTransform: 'uppercase' as const }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 20px' }
const infoBox = { backgroundColor: '#f9f7f2', padding: '16px 20px', borderRadius: '6px', borderLeft: '4px solid #d4af37', margin: '0 0 20px' }
const infoLine = { fontSize: '14px', color: '#333', lineHeight: '1.8', margin: '0' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
