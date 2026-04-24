import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface DocumentMissionAdminProps {
  attributionId?: string
  documentName?: string
  documentType?: string
  uploadedAt?: string
}

const DocumentMissionAdminEmail = ({
  attributionId, documentName, documentType, uploadedAt,
}: DocumentMissionAdminProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouveau document mission — Transports Ligneo</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Notification interne · Documents</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Nouveau document ajouté</Heading>
        <Text style={text}>Un document vient d’être ajouté à une mission convoyeur.</Text>
        <Section style={card}>
          <Text style={cardLine}><strong>Mission :</strong> {attributionId ?? '—'}</Text>
          <Text style={cardLine}><strong>Type :</strong> {documentType ?? '—'}</Text>
          <Text style={cardLine}><strong>Fichier :</strong> {documentName ?? '—'}</Text>
          <Text style={cardLine}><strong>Date :</strong> {uploadedAt ?? '—'}</Text>
        </Section>
        <Text style={text}>Le document est disponible dans le dashboard admin de la mission.</Text>
        <Text style={footer}>Notification automatique</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DocumentMissionAdminEmail,
  subject: 'Nouveau document ajouté à une mission',
  displayName: 'Document mission (notification admin)',
  to: 'contact@transportsligneo.fr',
  previewData: {
    attributionId: 'MISSION-001',
    documentName: 'pv_livraison.pdf',
    documentType: 'PV de livraison / restitution',
    uploadedAt: '24/04/2026 10:30',
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
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
