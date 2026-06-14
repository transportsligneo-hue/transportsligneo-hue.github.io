import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

interface Props {
  prenom?: string
  nom?: string
  email?: string
  telephone?: string
  depart?: string
  arrivee?: string
  date?: string
  prix?: number
  numero?: string
  type?: string
}

const Email = ({ prenom, nom, email, telephone, depart, arrivee, date, prix, numero, type }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouvelle demande — {numero ?? 'Transports Ligneo'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader tagline="Notification interne" />
        <Hr style={divider} />
        <Heading style={h1}>Nouvelle demande reçue</Heading>
        <Section style={card}>
          <Text style={cardLine}><strong>N° :</strong> {numero ?? '—'}</Text>
          <Text style={cardLine}><strong>Type :</strong> {type ?? 'Convoyage'}</Text>
          <Text style={cardLine}><strong>Client :</strong> {prenom ?? ''} {nom ?? ''}</Text>
          <Text style={cardLine}><strong>Email :</strong> {email ?? '—'}</Text>
          <Text style={cardLine}><strong>Téléphone :</strong> {telephone ?? '—'}</Text>
          <Text style={cardLine}><strong>Trajet :</strong> {depart ?? '—'} → {arrivee ?? '—'}</Text>
          <Text style={cardLine}><strong>Date :</strong> {date ?? '—'}</Text>
          <Text style={cardPrice}><strong>Prix estimé TTC :</strong> {prix != null ? `${prix.toFixed(2)} €` : '—'}</Text>
        </Section>
        <Text style={text}>À traiter depuis le dashboard admin → Demandes.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Nouvelle demande — ${d?.numero ?? 'Transports Ligneo'}`,
  displayName: 'Admin — Nouvelle demande',
  to: 'contact@transportsligneo.fr',
  previewData: {
    prenom: 'Jean', nom: 'Dupont', email: 'jean@example.com', telephone: '0612345678',
    depart: 'Tours', arrivee: 'Paris', date: '25/04/2026', prix: 237, numero: 'DEM-2026-001',
    type: 'Aller simple',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: '#0b1026', padding: '20px', borderRadius: '6px', margin: '20px 0' }
const cardLine = { fontSize: '13px', color: '#f5f1e8', margin: '6px 0', lineHeight: '1.5' }
const cardPrice = { fontSize: '15px', color: '#d4af37', margin: '14px 0 0', borderTop: '1px solid rgba(212,175,55,0.3)', paddingTop: '12px' }
