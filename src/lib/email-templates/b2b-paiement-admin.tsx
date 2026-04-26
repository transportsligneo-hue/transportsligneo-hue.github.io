import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  numero?: string
  pickup?: string
  dropoff?: string
  scheduledDate?: string
  scheduledTime?: string
  vehicleType?: string
  urgency?: string
  prixTtc?: number | null
  companyName?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

const Email = ({
  numero, pickup, dropoff, scheduledDate, scheduledTime, vehicleType,
  urgency, prixTtc, companyName, contactName, contactEmail, contactPhone,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouveau paiement B2B reçu — {numero ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Notification interne · B2B</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Nouveau paiement reçu</Heading>
        <Text style={text}>
          Une demande de transport ponctuel B2B vient d'être <strong>payée</strong> et passe automatiquement
          au statut <em>à dispatcher</em>.
        </Text>
        <Section style={card}>
          <Text style={cardLine}><strong>N° demande :</strong> {numero ?? '—'}</Text>
          <Text style={cardLine}><strong>Trajet :</strong> {pickup ?? '—'} → {dropoff ?? '—'}</Text>
          <Text style={cardLine}><strong>Date :</strong> {scheduledDate ?? '—'} à {scheduledTime ?? '—'}</Text>
          <Text style={cardLine}><strong>Véhicule :</strong> {vehicleType ?? '—'} · <strong>Urgence :</strong> {urgency ?? '—'}</Text>
          <Text style={cardPrice}><strong>Montant TTC :</strong> {prixTtc != null ? `${Number(prixTtc).toFixed(2)} €` : '—'}</Text>
        </Section>
        <Section style={cardLight}>
          <Text style={cardLineDark}><strong>Société :</strong> {companyName ?? '—'}</Text>
          <Text style={cardLineDark}><strong>Contact :</strong> {contactName ?? '—'}</Text>
          <Text style={cardLineDark}><strong>Email :</strong> {contactEmail ?? '—'}</Text>
          <Text style={cardLineDark}><strong>Tél :</strong> {contactPhone ?? '—'}</Text>
        </Section>
        <Text style={text}>
          Connectez-vous à <strong>Admin → Dispatch B2B</strong> pour assigner un convoyeur.
        </Text>
        <Text style={footer}>Notification automatique</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[B2B] Paiement reçu — ${d.numero ?? ''}`.trim(),
  displayName: 'Paiement B2B reçu (admin)',
  previewData: {
    numero: 'B2B-20260426-AB12CD',
    pickup: 'Tours, France',
    dropoff: 'Paris, France',
    scheduledDate: '2026-05-02',
    scheduledTime: '09:00',
    vehicleType: 'leger',
    urgency: 'planifie',
    prixTtc: 280,
    companyName: 'ACME SAS',
    contactName: 'Marc Dupont',
    contactEmail: 'marc@acme.fr',
    contactPhone: '+33 6 12 34 56 78',
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
const cardLight = { backgroundColor: '#f7f4ec', padding: '16px 20px', borderRadius: '6px', margin: '8px 0 20px' }
const cardLineDark = { fontSize: '13px', color: '#0b1026', margin: '4px 0', lineHeight: '1.5' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
