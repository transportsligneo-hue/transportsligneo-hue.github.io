import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

interface Props { prenom?: string; numero?: string; depart?: string; arrivee?: string }

const Email = (p: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Véhicule livré — {p.numero ?? 'Transports Ligneo'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader tagline="Convoyage automobile" />
        <Hr style={divider} />
        <Heading style={h1}>{p.prenom ? `${p.prenom},` : ''} votre véhicule est arrivé</Heading>
        <Text style={text}>
          Mission accomplie : l'état des lieux d'arrivée a été signé. Votre facture
          est disponible dans votre espace client.
        </Text>
        <Section style={card}>
          <Text style={cardLine}><strong>N° mission :</strong> {p.numero ?? '—'}</Text>
          <Text style={cardLine}><strong>Trajet :</strong> {p.depart ?? '—'} → {p.arrivee ?? '—'}</Text>
        </Section>
        <Text style={text}>
          Merci de votre confiance. Un avis sur notre service nous aiderait beaucoup —
          répondez simplement à cet email.
        </Text>
        <Text style={footer}>L'équipe Transports Ligneo — 07 82 45 61 81</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Véhicule livré — ${d?.numero ?? 'Transports Ligneo'}`,
  displayName: 'Mission livrée (client)',
  previewData: { prenom: 'Jean', numero: 'MIS-2026-001', depart: 'Tours', arrivee: 'Paris' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: '#0b1026', padding: '20px', borderRadius: '6px', margin: '20px 0' }
const cardLine = { fontSize: '13px', color: '#f5f1e8', margin: '6px 0', lineHeight: '1.5' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
