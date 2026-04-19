import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = "Transports Ligneo"

interface MissionConfirmationProps {
  prenom?: string
  numero?: string
  villeDepart?: string
  villeArrivee?: string
  date?: string
  prixTotal?: number
  typeTrajet?: string
}

const MissionConfirmationEmail = ({
  prenom, numero, villeDepart, villeArrivee, date, prixTotal, typeTrajet,
}: MissionConfirmationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réservation confirmée — {numero ?? 'Transports Ligneo'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>TRANSPORTS LIGNEO</Heading>
          <Text style={subtitle}>Convoyage automobile premium</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>
          {prenom ? `Merci ${prenom},` : 'Merci !'} votre réservation est enregistrée
        </Heading>
        <Text style={text}>
          Votre demande de convoyage a bien été reçue. Voici le récapitulatif :
        </Text>

        <Section style={card}>
          <Text style={cardLine}><strong>N° de mission :</strong> {numero ?? '—'}</Text>
          <Text style={cardLine}><strong>Trajet :</strong> {villeDepart ?? '—'} → {villeArrivee ?? '—'}</Text>
          <Text style={cardLine}><strong>Date :</strong> {date ?? '—'}</Text>
          <Text style={cardLine}><strong>Type :</strong> {typeTrajet ?? '—'}</Text>
          <Text style={cardPrice}><strong>Prix total TTC :</strong> {prixTotal != null ? `${prixTotal.toFixed(2)} €` : '—'}</Text>
        </Section>

        <Text style={text}>
          Notre équipe va valider votre mission et vous recontactera très rapidement.
          Pour toute question, contactez-nous au <strong>07 82 45 61 81</strong> ou
          à <strong>contact@transportsligneo.fr</strong>.
        </Text>

        <Text style={footer}>Cordialement, L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MissionConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Réservation confirmée — ${data?.numero ?? 'Transports Ligneo'}`,
  displayName: 'Confirmation de réservation',
  previewData: {
    prenom: 'Jean',
    numero: 'MIS-20260419-ABC123',
    villeDepart: 'Tours',
    villeArrivee: 'Paris',
    date: '25/04/2026',
    prixTotal: 237,
    typeTrajet: 'Aller simple',
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
