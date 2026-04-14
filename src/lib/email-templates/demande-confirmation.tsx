import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = "Transports Ligneo"

interface DemandeConfirmationProps {
  prenom?: string
  nom?: string
  depart?: string
  arrivee?: string
}

const DemandeConfirmationEmail = ({ prenom, nom, depart, arrivee }: DemandeConfirmationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre demande de convoyage a bien été reçue — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Convoyage automobile premium</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>
          {prenom ? `Merci ${prenom} !` : 'Merci pour votre demande !'}
        </Heading>
        <Text style={text}>
          Nous avons bien reçu votre demande de convoyage{depart && arrivee ? ` de ${depart} à ${arrivee}` : ''}.
        </Text>
        <Text style={text}>
          Notre équipe va étudier votre demande et vous recontactera dans les plus brefs délais
          pour vous proposer un devis personnalisé.
        </Text>
        <Text style={text}>
          Si vous avez des questions, n'hésitez pas à nous contacter au <strong>07 82 45 61 81</strong> ou
          par email à <strong>contact@transportsligneo.fr</strong>.
        </Text>
        <Text style={footer}>Cordialement, L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DemandeConfirmationEmail,
  subject: 'Votre demande de convoyage — Transports Ligneo',
  displayName: 'Confirmation de demande',
  previewData: { prenom: 'Jean', nom: 'Dupont', depart: 'Tours', arrivee: 'Paris' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Playfair Display', Georgia, serif" }
const container = { padding: '30px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '20px 0' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#d4af37', letterSpacing: '3px', margin: '0' }
const subtitle = { fontSize: '11px', color: '#0b1026', letterSpacing: '2px', margin: '5px 0 0', textTransform: 'uppercase' as const }
const divider = { borderColor: '#d4af37', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0b1026', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 20px' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
