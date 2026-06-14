import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

interface Props {
  prenom?: string; nom?: string; email?: string; numero?: string
  depart?: string; arrivee?: string; date?: string; prix?: number
}

const Email = (p: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Devis accepté & signé — {p.numero ?? 'Transports Ligneo'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader tagline="Notification interne" />
        <Hr style={divider} />
        <Heading style={h1}>Devis signé par le client</Heading>
        <Section style={card}>
          <Text style={cardLine}><strong>N° devis :</strong> {p.numero ?? '—'}</Text>
          <Text style={cardLine}><strong>Client :</strong> {p.prenom ?? ''} {p.nom ?? ''} — {p.email ?? '—'}</Text>
          <Text style={cardLine}><strong>Trajet :</strong> {p.depart ?? '—'} → {p.arrivee ?? '—'}</Text>
          <Text style={cardLine}><strong>Date :</strong> {p.date ?? '—'}</Text>
          <Text style={cardPrice}><strong>Montant TTC :</strong> {p.prix != null ? `${p.prix.toFixed(2)} €` : '—'}</Text>
        </Section>
        <Text style={text}>Mission auto-créée. À planifier dans dashboard admin → Missions.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Devis signé — ${d?.numero ?? 'Transports Ligneo'}`,
  displayName: 'Admin — Devis accepté',
  to: 'contact@transportsligneo.fr',
  previewData: { prenom: 'Jean', nom: 'Dupont', email: 'j@x.fr', numero: 'DEV-2026-000123', depart: 'Tours', arrivee: 'Paris', date: '25/04', prix: 237 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: '#0b1026', padding: '20px', borderRadius: '6px', margin: '20px 0' }
const cardLine = { fontSize: '13px', color: '#f5f1e8', margin: '6px 0', lineHeight: '1.5' }
const cardPrice = { fontSize: '15px', color: '#d4af37', margin: '14px 0 0', borderTop: '1px solid rgba(212,175,55,0.3)', paddingTop: '12px' }
