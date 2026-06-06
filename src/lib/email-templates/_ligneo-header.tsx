import * as React from 'react'
import { Img, Section, Text } from '@react-email/components'

/**
 * En-tête commun à tous les emails Transports Ligneo.
 * Logo officiel hébergé sur le site publié (URL absolue obligatoire pour s'afficher
 * dans les clients mail comme Gmail / Outlook).
 */
export const LIGNEO_LOGO_URL = 'https://transportsligneo.fr/logo-ligneo.png'
export const LIGNEO_SITE = 'Transports Ligneo'
export const LIGNEO_TEL = '07 82 45 61 81'
export const LIGNEO_EMAIL = 'contact@transportsligneo.fr'

export function LigneoEmailHeader({ tagline }: { tagline?: string }) {
  return (
    <Section style={headerStyle}>
      <Img
        src={LIGNEO_LOGO_URL}
        alt="Transports Ligneo"
        width="160"
        height="auto"
        style={{ margin: '0 auto', display: 'block' }}
      />
      {tagline ? <Text style={taglineStyle}>{tagline}</Text> : null}
    </Section>
  )
}

const headerStyle = {
  textAlign: 'center' as const,
  padding: '24px 0 16px',
}
const taglineStyle = {
  fontSize: '11px',
  color: '#0b1026',
  letterSpacing: '2px',
  margin: '10px 0 0',
  textTransform: 'uppercase' as const,
  fontFamily: "'Playfair Display', Georgia, serif",
}
