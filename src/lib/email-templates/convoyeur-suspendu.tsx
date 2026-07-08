import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import { LigneoEmailHeader } from './_ligneo-header'

const SITE_NAME = 'Transports Ligneo'

interface ConvoyeurSuspenduProps {
  prenom?: string
  nom?: string
  motif?: string
  reactive?: boolean
}

const ConvoyeurSuspenduEmail = ({ prenom, nom, motif, reactive }: ConvoyeurSuspenduProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>
      {reactive
        ? `Votre compte convoyeur est réactivé — ${SITE_NAME}`
        : `Votre compte convoyeur est temporairement suspendu — ${SITE_NAME}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <LigneoEmailHeader tagline="Convoyage automobile" />
        <Hr style={divider} />
        <Heading style={h1}>
          {reactive ? '✅ Compte réactivé' : '⚠️ Compte suspendu'}
        </Heading>
        <Text style={text}>Bonjour {prenom || ''} {nom || ''},</Text>
        {reactive ? (
          <>
            <Text style={text}>
              Bonne nouvelle : votre compte convoyeur vient d'être <strong>réactivé</strong>.
              Vous pouvez à nouveau accéder à votre espace et accepter des missions.
            </Text>
          </>
        ) : (
          <>
            <Text style={text}>
              Votre compte convoyeur vient d'être <strong>temporairement suspendu</strong> par notre équipe.
              Vous ne pouvez plus vous connecter tant que votre compte n'a pas été réactivé.
            </Text>
            {motif && (
              <Section style={motifBox}>
                <Text style={motifTitle}>Motif</Text>
                <Text style={motifText}>{motif}</Text>
              </Section>
            )}
            <Text style={text}>
              Pour toute question, répondez directement à cet email — nous reviendrons vers vous rapidement.
            </Text>
          </>
        )}
        <Text style={footer}>— L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConvoyeurSuspenduEmail,
  subject: (data: Record<string, any>) => data?.reactive
    ? 'Votre compte convoyeur est réactivé — Transports Ligneo'
    : 'Votre compte convoyeur est temporairement suspendu — Transports Ligneo',
  displayName: 'Suspension / réactivation convoyeur',
  previewData: { prenom: 'Jean', nom: 'Dupont', motif: 'Vérification en cours' },
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
