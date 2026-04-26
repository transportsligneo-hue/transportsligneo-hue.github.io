import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  numero?: string
  scoreCategory?: 'hot' | 'warm' | 'cold' | string
  leadScore?: number
  companyName?: string
  structureType?: string
  size?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  needType?: string
  vehicleCount?: number
  frequency?: string
  startDelay?: string
  budget?: string | null
  description?: string | null
}

const labelCat = (c?: string) => c === 'hot' ? '🔥 HOT' : c === 'warm' ? '⭐ WARM' : 'COLD'
const colorCat = (c?: string) => c === 'hot' ? '#c0392b' : c === 'warm' ? '#d4af37' : '#7a7a7a'

const Email = ({
  numero, scoreCategory, leadScore, companyName, structureType, size,
  contactName, contactEmail, contactPhone, needType, vehicleCount,
  frequency, startDelay, budget, description,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouveau lead flotte {labelCat(scoreCategory)} — {companyName ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Notification interne · CRM Flotte</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Nouveau lead flotte</Heading>
        <Section style={{ ...badgeWrap, backgroundColor: colorCat(scoreCategory) }}>
          <Text style={badge}>{labelCat(scoreCategory)} · score {leadScore ?? 0}/100</Text>
        </Section>
        <Section style={card}>
          <Text style={cardLine}><strong>N° lead :</strong> {numero ?? '—'}</Text>
          <Text style={cardLine}><strong>Société :</strong> {companyName ?? '—'} ({structureType ?? '—'}, {size ?? '—'})</Text>
          <Text style={cardLine}><strong>Contact :</strong> {contactName ?? '—'}</Text>
          <Text style={cardLine}><strong>Email :</strong> {contactEmail ?? '—'}</Text>
          <Text style={cardLine}><strong>Tél :</strong> {contactPhone ?? '—'}</Text>
        </Section>
        <Section style={cardLight}>
          <Text style={cardLineDark}><strong>Besoin :</strong> {needType ?? '—'}</Text>
          <Text style={cardLineDark}><strong>Véhicules :</strong> {vehicleCount ?? '—'} · <strong>Fréquence :</strong> {frequency ?? '—'}</Text>
          <Text style={cardLineDark}><strong>Démarrage :</strong> {startDelay ?? '—'}</Text>
          {budget && <Text style={cardLineDark}><strong>Budget :</strong> {budget}</Text>}
          {description && <Text style={cardLineDark}><strong>Détail :</strong> {description}</Text>}
        </Section>
        <Text style={text}>
          {scoreCategory === 'hot'
            ? '⚡ Lead chaud à rappeler en priorité (sous 4h ouvrées).'
            : scoreCategory === 'warm'
            ? 'Lead intéressant à qualifier sous 24h ouvrées.'
            : 'Lead à qualifier dans le pipeline standard.'}
        </Text>
        <Text style={text}>
          Connectez-vous à <strong>Admin → CRM Flotte</strong> pour traiter ce lead.
        </Text>
        <Text style={footer}>Notification automatique</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `[Flotte ${labelCat(d.scoreCategory)}] ${d.companyName ?? 'Lead'} — ${d.vehicleCount ?? '?'} véh.`,
  displayName: 'Lead flotte B2B (admin)',
  previewData: {
    numero: 'LEAD-20260426-XY99ZZ',
    scoreCategory: 'hot',
    leadScore: 85,
    companyName: 'GroupAuto Loueurs',
    structureType: 'loueur',
    size: '51-250',
    contactName: 'Sophie Martin',
    contactEmail: 'sophie@groupauto.fr',
    contactPhone: '+33 1 45 67 89 00',
    needType: 'gestion_flotte',
    vehicleCount: 80,
    frequency: 'mensuelle',
    startDelay: 'immediat',
    budget: '15 000 €/mois',
    description: 'Convoyage régulier entre agences IDF.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '20px 0' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#d4af37', letterSpacing: '3px', margin: '0' }
const subtitle = { fontSize: '11px', color: '#0b1026', letterSpacing: '2px', margin: '5px 0 0', textTransform: 'uppercase' as const }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 16px' }
const badgeWrap = { textAlign: 'center' as const, padding: '10px 16px', borderRadius: '6px', margin: '0 0 18px' }
const badge = { fontSize: '13px', fontWeight: 'bold' as const, color: '#fff', letterSpacing: '2px', margin: '0', textTransform: 'uppercase' as const }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: '#0b1026', padding: '20px', borderRadius: '6px', margin: '20px 0' }
const cardLine = { fontSize: '13px', color: '#f5f1e8', margin: '6px 0', lineHeight: '1.5' }
const cardLight = { backgroundColor: '#f7f4ec', padding: '16px 20px', borderRadius: '6px', margin: '8px 0 20px' }
const cardLineDark = { fontSize: '13px', color: '#0b1026', margin: '4px 0', lineHeight: '1.5' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
