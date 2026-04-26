import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  companyName?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  paidCount?: number
  totalAmount?: number
}

const Email = ({
  companyName, contactName, contactEmail, contactPhone, paidCount, totalAmount,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Opportunité de conversion flotte — {companyName ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Notification interne · Opportunité commerciale</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Client ponctuel à convertir en flotte</Heading>
        <Text style={text}>
          La société <strong>{companyName ?? '—'}</strong> a passé{' '}
          <strong>{paidCount ?? 0} commandes payées</strong>
          {totalAmount ? <> pour un total de <strong>{Number(totalAmount).toFixed(0)} € TTC</strong></> : null}.
          Elle est probablement candidate à un partenariat flotte récurrent.
        </Text>
        <Section style={card}>
          <Text style={cardLine}><strong>Société :</strong> {companyName ?? '—'}</Text>
          <Text style={cardLine}><strong>Contact :</strong> {contactName ?? '—'}</Text>
          <Text style={cardLine}><strong>Email :</strong> {contactEmail ?? '—'}</Text>
          <Text style={cardLine}><strong>Tél :</strong> {contactPhone ?? '—'}</Text>
          <Text style={cardPrice}><strong>Commandes payées :</strong> {paidCount ?? 0}</Text>
        </Section>
        <Text style={text}>
          Action suggérée : appeler le contact pour proposer une <strong>étude flotte</strong>{' '}
          (tarifs négociés, account manager dédié, facturation centralisée).
        </Text>
        <Text style={text}>
          Connectez-vous à <strong>Admin → CRM Flotte</strong> pour créer le lead correspondant.
        </Text>
        <Text style={footer}>Notification automatique</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `[Conversion] ${d.companyName ?? 'Client'} — ${d.paidCount ?? 0} courses payées`,
  displayName: 'Suggestion conversion flotte (admin)',
  previewData: {
    companyName: 'ACME SAS',
    contactName: 'Marc Dupont',
    contactEmail: 'marc@acme.fr',
    contactPhone: '+33 6 12 34 56 78',
    paidCount: 3,
    totalAmount: 840,
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
