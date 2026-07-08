import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

const SITE_NAME = 'Transports Ligneo'

interface ConvoyeurRefuseProps {
  prenom?: string
  nom?: string
  motif?: string
}

const ConvoyeurRefuseEmail = ({ prenom, nom, motif }: ConvoyeurRefuseProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Suite à votre candidature convoyeur — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader tagline="Convoyage automobile" />
        <Hr style={divider} />
        <Heading style={h1}>Bonjour {prenom || ''} {nom || ''}</Heading>
        <Text style={text}>
          Nous avons étudié votre dossier de candidature et nous ne pouvons pas y donner suite pour le moment.
        </Text>
        {motif && (
          <Section style={motifBox}>
            <Text style={motifTitle}>Motif</Text>
            <Text style={motifText}>{motif}</Text>
          </Section>
        )}
        <Text style={text}>
          Vous pouvez nous recontacter à tout moment pour représenter votre candidature avec de nouveaux documents.
        </Text>
        <Text style={footer}>— L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConvoyeurRefuseEmail,
  subject: 'Suite à votre candidature convoyeur — Transports Ligneo',
  displayName: 'Refus candidature convoyeur',
  previewData: { prenom: 'Jean', nom: 'Dupont', motif: 'Dossier incomplet' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 18px' }
const motifBox = { backgroundColor: '#faf7ef', border: '1px solid #e7c76a', borderRadius: '6px', padding: '14px 18px', margin: '18px 0' }
const motifTitle = { fontSize: '11px', color: '#0b1026', letterSpacing: '2px', textTransform: 'uppercase' as const, margin: '0 0 6px', fontWeight: 'bold' as const }
const motifText = { fontSize: '14px', color: '#333', margin: '0', lineHeight: '1.5' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
