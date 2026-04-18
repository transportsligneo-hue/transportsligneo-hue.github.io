import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = "Transports Ligneo"

interface DevisClientProps {
  prenom?: string
  nom?: string
  numero?: string
  depart?: string
  arrivee?: string
  distance?: number | string
  prix?: number | string
  optionTrajet?: string
}

const DevisClientEmail = ({ prenom, numero, depart, arrivee, distance, prix, optionTrajet }: DevisClientProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre devis {numero ? `n° ${numero}` : ''} — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Convoyage automobile premium</Text>
        </Section>
        <Hr style={divider} />

        <Heading style={h1}>
          {prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
        </Heading>
        <Text style={text}>
          Nous vous remercions pour votre demande d'estimation. Vous trouverez ci-dessous
          le récapitulatif de votre devis{numero ? ` n° ${numero}` : ''}.
        </Text>

        <Section style={card}>
          <Text style={cardLabel}>TRAJET</Text>
          <Text style={cardValue}>{depart} → {arrivee}</Text>
          {distance && <Text style={cardMeta}>Distance estimée : {distance} km</Text>}
          {optionTrajet && <Text style={cardMeta}>Option : {optionTrajet}</Text>}
        </Section>

        <Section style={priceBox}>
          <Text style={priceLabel}>MONTANT ESTIMÉ</Text>
          <Text style={priceValue}>{prix} €</Text>
          <Text style={priceMeta}>TTC — Péage et carburant inclus</Text>
        </Section>

        <Text style={text}>
          Le devis détaillé au format PDF est disponible sur demande. Notre équipe vous
          recontactera très prochainement pour finaliser votre réservation.
        </Text>

        <Text style={text}>
          Pour toute question, contactez-nous au <strong>07 82 45 61 81</strong> ou
          par email à <strong>contact@transportsligneo.fr</strong>.
        </Text>

        <Text style={footer}>Cordialement, L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DevisClientEmail,
  subject: (data: Record<string, any>) =>
    `Votre devis ${data.numero ? `n° ${data.numero} ` : ''}— Transports Ligneo`,
  displayName: 'Devis client',
  previewData: {
    prenom: 'Jean', nom: 'Dupont', numero: 'DEV-20260418-A1B2C3',
    depart: 'Tours', arrivee: 'Paris', distance: 237, prix: 237, optionTrajet: 'aller-simple',
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
const card = { backgroundColor: '#f8f6f0', border: '1px solid #d4af37', borderRadius: '4px', padding: '16px 20px', margin: '0 0 16px' }
const cardLabel = { fontSize: '10px', color: '#0b1026', letterSpacing: '2px', margin: '0 0 6px', fontWeight: 'bold' as const }
const cardValue = { fontSize: '15px', color: '#0b1026', margin: '0 0 4px', fontWeight: 'bold' as const }
const cardMeta = { fontSize: '12px', color: '#666', margin: '2px 0' }
const priceBox = { backgroundColor: '#0b1026', border: '2px solid #d4af37', borderRadius: '4px', padding: '20px', margin: '0 0 20px', textAlign: 'center' as const }
const priceLabel = { fontSize: '11px', color: '#e7c76a', letterSpacing: '2px', margin: '0 0 8px' }
const priceValue = { fontSize: '32px', color: '#d4af37', margin: '0 0 6px', fontWeight: 'bold' as const }
const priceMeta = { fontSize: '11px', color: '#cccccc', margin: '0' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
