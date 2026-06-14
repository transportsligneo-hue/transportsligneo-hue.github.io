import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  depart?: string
  arrivee?: string
  montant?: string
  dateAcceptation?: string
  version?: string
}

const Email = ({ prenom, numero, depart, arrivee, montant, dateAcceptation, version }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre devis {numero ?? ''} est accepté et signé — Transports Ligneo</Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader />
        <Section style={section}>
          <Heading style={h1}>Devis accepté ✓</Heading>
          <Text style={text}>
            {prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
          </Text>
          <Text style={text}>
            Nous confirmons l'acceptation et la signature de votre devis
            {numero ? <strong> {numero}</strong> : null}
            {version ? ` (version ${version})` : ''}.
            Une preuve d'acceptation horodatée a été enregistrée et le document est figé.
          </Text>
          <Section style={recap}>
            {depart && arrivee && (
              <Text style={recapLine}><strong>Trajet :</strong> {depart} → {arrivee}</Text>
            )}
            {montant && (
              <Text style={recapLine}><strong>Montant accepté :</strong> {montant} TTC</Text>
            )}
            {dateAcceptation && (
              <Text style={recapLine}><strong>Accepté le :</strong> {dateAcceptation}</Text>
            )}
          </Section>
          <Text style={text}>
            Vous retrouverez votre devis signé (PDF) à tout moment dans votre espace client,
            rubrique « Mes devis ».
          </Text>
          <Hr style={hr} />
          <Text style={muted}>
            Transports Ligneo — Convoyage automobile · contact@transportsligneo.fr · 07 82 45 61 81
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `Devis ${data.numero ?? ''} accepté — Transports Ligneo`,
  displayName: 'Devis accepté (client)',
  previewData: {
    prenom: 'Jean',
    numero: 'DEV-2026-000012',
    depart: 'Tours',
    arrivee: 'Paris',
    montant: '95,00 €',
    dateAcceptation: '11/06/2026 à 14:32',
    version: '1',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { margin: '0 auto', maxWidth: '600px' }
const section = { padding: '24px 28px' }
const h1 = { color: '#0b1026', fontSize: '22px', margin: '0 0 16px' }
const text = { color: '#33333d', fontSize: '14px', lineHeight: '22px' }
const recap = { backgroundColor: '#faf7ef', border: '1px solid #e7dcc0', borderRadius: '6px', padding: '14px 18px', margin: '16px 0' }
const recapLine = { color: '#0b1026', fontSize: '13px', lineHeight: '20px', margin: '4px 0' }
const hr = { borderColor: '#e7dcc0', margin: '20px 0' }
const muted = { color: '#8a8a96', fontSize: '11px', lineHeight: '16px' }
