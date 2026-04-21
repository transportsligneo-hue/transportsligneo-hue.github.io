import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface NouvelleOffreAdminProps {
  convoyeurNom?: string
  depart?: string
  arrivee?: string
  date?: string
  prixSuggere?: number | null
  prixPropose?: number
  typeOffre?: string
  message?: string | null
}

const NouvelleOffreAdminEmail = ({
  convoyeurNom, depart, arrivee, date, prixSuggere, prixPropose, typeOffre, message,
}: NouvelleOffreAdminProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouvelle offre convoyeur — Transports Ligneo</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Notification interne · Enchères</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Nouvelle offre reçue</Heading>
        <Text style={text}>
          <strong>{convoyeurNom ?? 'Un convoyeur'}</strong> vient de
          {typeOffre === 'acceptation_directe' ? ' accepter le prix suggéré' : ' envoyer une contre-proposition'}.
        </Text>
        <Section style={card}>
          <Text style={cardLine}><strong>Trajet :</strong> {depart ?? '—'} → {arrivee ?? '—'}</Text>
          <Text style={cardLine}><strong>Date :</strong> {date ?? '—'}</Text>
          <Text style={cardLine}><strong>Prix suggéré :</strong> {prixSuggere != null ? `${prixSuggere} €` : '—'}</Text>
          <Text style={cardPrice}><strong>Offre convoyeur :</strong> {prixPropose != null ? `${prixPropose} €` : '—'}</Text>
        </Section>
        {message && (
          <Text style={text}><strong>Message :</strong> {message}</Text>
        )}
        <Text style={text}>
          Connectez-vous au dashboard admin (Trajets) pour valider ou refuser cette offre.
        </Text>
        <Text style={footer}>Notification automatique</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NouvelleOffreAdminEmail,
  subject: 'Nouvelle offre convoyeur reçue',
  displayName: 'Nouvelle offre (notification admin)',
  to: 'contact@transportsligneo.fr',
  previewData: {
    convoyeurNom: 'Marc Dupont',
    depart: 'Tours',
    arrivee: 'Paris',
    date: '02/05/2026',
    prixSuggere: 250,
    prixPropose: 230,
    typeOffre: 'contre_proposition',
    message: 'Disponible toute la journée, retour possible.',
  },
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
