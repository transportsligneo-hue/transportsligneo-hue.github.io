import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

/**
 * Shell email premium Transports Ligneo — style flyer navy/or.
 * Toutes les templates s'appuient sur ce composant pour une cohérence visuelle
 * absolue (fond navy, filet doré, wordmark Playfair, footer contact doré,
 * bandeau confiance).
 */

export const LIGNEO_SITE = 'Transports Ligneo'
export const LIGNEO_SITE_URL = 'www.transportsligneo.fr'
export const LIGNEO_TEL = '07 82 45 61 81'
export const LIGNEO_EMAIL = 'contact@transportsligneo.fr'
export const LIGNEO_LOGO_URL = 'https://transportsligneo.fr/logo-ligneo.png'

// Palette — miroir du site
const NAVY = '#0b1026'
const NAVY_DEEP = '#070a1c'
const NAVY_SOFT = '#111a3d'
const GOLD = '#d4af37'
const GOLD_LIGHT = '#e7c76a'
const CREAM = '#faf7ef'
const CREAM_SOFT = '#fdfcf8'
const TEXT_DARK = '#1a1f36'
const TEXT_MUTED = '#5b6479'
const SUCCESS_BG = '#eaf7ee'
const SUCCESS_BORDER = '#2f9d55'
const SUCCESS_TEXT = '#186a34'
const DANGER_BG = '#fdecec'
const DANGER_BORDER = '#c0392b'
const DANGER_TEXT = '#7a1b12'

const FONT_STACK_HEAD = "'Playfair Display', Georgia, 'Times New Roman', serif"
const FONT_STACK_BODY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"

// ---------- SHELL ----------

export interface LigneoEmailShellProps {
  preview: string
  /** Petite étiquette gold en haut du bandeau (ex: "Devis disponible"). */
  tagline?: string
  /** Titre principal en petites capitales (ex: "DEMANDE DE DEVIS REÇUE"). */
  title: string
  /** Icône emoji ou courte string affichée à gauche du titre. */
  icon?: string
  /** Salutation (ex: "Bonjour Jean,"). */
  greeting?: string
  /** Paragraphe d'intro sous le titre. */
  intro?: React.ReactNode
  /** Contenu additionnel (Recap, Highlight, etc.). */
  children?: React.ReactNode
  /** Bouton principal (or plein). */
  primaryCta?: { label: string; href: string } | null
  /** Bouton secondaire (contour or). */
  secondaryCta?: { label: string; href: string } | null
  /** Signature finale. Défaut: "L'équipe Transports Ligneo". */
  signature?: string
}

export function LigneoEmailShell({
  preview,
  tagline,
  title,
  icon,
  greeting,
  intro,
  children,
  primaryCta,
  secondaryCta,
  signature,
}: LigneoEmailShellProps) {
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={outerContainer}>
          {/* Carte navy premium */}
          <Section style={card}>
            {/* Filet or supérieur */}
            <Section style={goldTopBar} />

            {/* En-tête wordmark */}
            <Section style={headerSection}>
              <Text style={carGlyph}>🚗</Text>
              <Text style={wordmark}>TRANSPORTS LIGNEO</Text>
              <Text style={wordmarkRule}>&nbsp;</Text>
              {tagline ? <Text style={taglineStyle}>{tagline}</Text> : null}
            </Section>

            {/* Zone contenu crème */}
            <Section style={contentWrap}>
              <Section style={contentInner}>
                <Text style={titleStyle}>
                  {icon ? <span style={{ marginRight: 8 }}>{icon}</span> : null}
                  {title}
                </Text>

                {greeting ? <Text style={greetingStyle}>{greeting}</Text> : null}
                {intro ? <Text style={introStyle}>{intro}</Text> : null}

                {children}

                {primaryCta ? (
                  <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
                    <Button href={primaryCta.href} style={primaryButtonStyle}>
                      {primaryCta.label}
                    </Button>
                  </Section>
                ) : null}
                {secondaryCta ? (
                  <Section style={{ textAlign: 'center', margin: '4px 0 8px' }}>
                    <Button href={secondaryCta.href} style={secondaryButtonStyle}>
                      {secondaryCta.label}
                    </Button>
                  </Section>
                ) : null}

                <Text style={signatureStyle}>
                  {signature || `Cordialement,\nL'équipe ${LIGNEO_SITE}`}
                </Text>
              </Section>
            </Section>

            {/* Footer navy avec contacts dorés */}
            <Section style={footerBar}>
              <Text style={footerLine}>
                <span style={footerIcon}>🌐</span>
                <a href={`https://${LIGNEO_SITE_URL}`} style={footerLink}>
                  {LIGNEO_SITE_URL}
                </a>
              </Text>
              <Text style={footerLine}>
                <span style={footerIcon}>✉</span>
                <a href={`mailto:${LIGNEO_EMAIL}`} style={footerLink}>
                  {LIGNEO_EMAIL}
                </a>
              </Text>
              <Text style={footerLine}>
                <span style={footerIcon}>📞</span>
                <a href={`tel:+33${LIGNEO_TEL.replace(/\s/g, '').slice(1)}`} style={footerLink}>
                  {LIGNEO_TEL}
                </a>
              </Text>
            </Section>
          </Section>

          {/* Bandeau confiance */}
          <Section style={trustBar}>
            <Text style={trustItem}>
              <span style={trustGold}>◆</span> Plateforme sécurisée et certifiée
            </Text>
            <Text style={trustItem}>
              <span style={trustGold}>◆</span> Convoyage automobile partout en France
            </Text>
            <Text style={trustItem}>
              <span style={trustGold}>◆</span> Suivi en temps réel et transparent
            </Text>
            <Text style={trustItem}>
              <span style={trustGold}>◆</span> Partenaire de confiance à vos côtés
            </Text>
          </Section>

          <Text style={legal}>
            Transports LIGNEO — Basé à TOURS (37) — RCS TOURS 753 320 001 000 70 — contact@transportsligneo.fr — www.transportsligneo.fr
          </Text>
          <Text style={legalSmall}>
            Cet e-mail est envoyé automatiquement, merci de ne pas y répondre.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ---------- Ancien header (backward compat) ----------

export function LigneoEmailHeader({ tagline }: { tagline?: string }) {
  return (
    <Section style={headerSection}>
      <Text style={carGlyph}>🚗</Text>
      <Text style={wordmark}>TRANSPORTS LIGNEO</Text>
      {tagline ? <Text style={taglineStyle}>{tagline}</Text> : null}
    </Section>
  )
}

// ---------- Sub-composants réutilisables ----------

export function RecapCard({
  title,
  rows,
}: {
  title?: string
  rows: Array<{ label: string; value: React.ReactNode }>
}) {
  return (
    <Section style={recapCard}>
      {title ? <Text style={recapTitle}>{title}</Text> : null}
      <table style={recapTable} cellPadding={0} cellSpacing={0} role="presentation">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={recapLabel}>{row.label}</td>
              <td style={recapValue}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

export function HighlightBox({
  label,
  value,
  meta,
  tone = 'gold',
}: {
  label?: string
  value: React.ReactNode
  meta?: React.ReactNode
  tone?: 'gold' | 'success' | 'danger' | 'navy'
}) {
  const styles = {
    gold: highlightGold,
    success: highlightSuccess,
    danger: highlightDanger,
    navy: highlightNavy,
  }
  const labelStyles = {
    gold: highlightGoldLabel,
    success: highlightSuccessLabel,
    danger: highlightDangerLabel,
    navy: highlightNavyLabel,
  }
  const valueStyles = {
    gold: highlightGoldValue,
    success: highlightSuccessValue,
    danger: highlightDangerValue,
    navy: highlightNavyValue,
  }
  return (
    <Section style={styles[tone]}>
      {label ? <Text style={labelStyles[tone]}>{label}</Text> : null}
      <Text style={valueStyles[tone]}>{value}</Text>
      {meta ? <Text style={highlightMeta}>{meta}</Text> : null}
    </Section>
  )
}

export function InfoParagraph({ children }: { children: React.ReactNode }) {
  return <Text style={introStyle}>{children}</Text>
}

export function Divider() {
  return <Hr style={divider} />
}

// ---------- STYLES ----------

const bodyStyle = {
  backgroundColor: '#ffffff',
  margin: 0,
  padding: '24px 8px',
  fontFamily: FONT_STACK_BODY,
  color: TEXT_DARK,
}

const outerContainer = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: 0,
}

const card = {
  backgroundColor: NAVY,
  borderRadius: '18px',
  border: `1px solid ${GOLD}33`,
  overflow: 'hidden' as const,
  boxShadow: '0 12px 40px rgba(11,16,38,0.18)',
  padding: 0,
}

const goldTopBar = {
  height: '6px',
  backgroundColor: GOLD,
  padding: 0,
  margin: 0,
  lineHeight: '6px',
  fontSize: '1px',
}

const headerSection = {
  backgroundColor: NAVY,
  padding: '28px 24px 18px',
  textAlign: 'center' as const,
  borderBottom: `1px solid ${GOLD}22`,
}

const carGlyph = {
  fontSize: '32px',
  color: GOLD,
  margin: '0 0 6px',
  lineHeight: '1',
  textAlign: 'center' as const,
}

const wordmark = {
  fontFamily: FONT_STACK_HEAD,
  fontSize: '22px',
  color: GOLD,
  letterSpacing: '0.22em',
  fontWeight: 700,
  margin: '0',
  textAlign: 'center' as const,
  lineHeight: '1.2',
}

const wordmarkRule = {
  display: 'block',
  width: '48px',
  height: '2px',
  backgroundColor: GOLD,
  margin: '10px auto 0',
  fontSize: '1px',
  lineHeight: '1px',
  color: NAVY,
}

const taglineStyle = {
  fontSize: '11px',
  color: GOLD_LIGHT,
  letterSpacing: '0.28em',
  margin: '12px 0 0',
  textTransform: 'uppercase' as const,
  fontFamily: FONT_STACK_BODY,
  textAlign: 'center' as const,
}

const contentWrap = {
  backgroundColor: CREAM_SOFT,
  padding: '0',
}

const contentInner = {
  padding: '28px 28px 20px',
}

const titleStyle = {
  fontFamily: FONT_STACK_HEAD,
  fontSize: '18px',
  fontWeight: 700,
  color: NAVY,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  margin: '0 0 18px',
  lineHeight: '1.3',
}

const greetingStyle = {
  fontSize: '15px',
  color: TEXT_DARK,
  margin: '0 0 10px',
  fontWeight: 600,
}

const introStyle = {
  fontSize: '14px',
  color: TEXT_DARK,
  lineHeight: '1.65',
  margin: '0 0 14px',
}

const signatureStyle = {
  fontSize: '13px',
  color: TEXT_MUTED,
  margin: '24px 0 0',
  whiteSpace: 'pre-line' as const,
  fontStyle: 'italic' as const,
}

// Recap
const recapCard = {
  backgroundColor: '#ffffff',
  border: `1px solid ${GOLD}55`,
  borderLeft: `3px solid ${GOLD}`,
  borderRadius: '8px',
  padding: '16px 18px',
  margin: '4px 0 16px',
}
const recapTitle = {
  fontSize: '10px',
  color: NAVY,
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  fontWeight: 700,
  margin: '0 0 10px',
}
const recapTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
}
const recapLabel = {
  fontSize: '12px',
  color: TEXT_MUTED,
  padding: '4px 12px 4px 0',
  verticalAlign: 'top' as const,
  whiteSpace: 'nowrap' as const,
  width: '38%',
  fontWeight: 500,
}
const recapValue = {
  fontSize: '13px',
  color: NAVY,
  padding: '4px 0',
  verticalAlign: 'top' as const,
  fontWeight: 600,
}

// Highlight - Gold (navy bg + gold border)
const highlightGold = {
  backgroundColor: NAVY,
  border: `2px solid ${GOLD}`,
  borderRadius: '10px',
  padding: '18px',
  margin: '4px 0 18px',
  textAlign: 'center' as const,
}
const highlightGoldLabel = {
  fontSize: '11px',
  color: GOLD_LIGHT,
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  margin: '0 0 8px',
  fontWeight: 600,
}
const highlightGoldValue = {
  fontSize: '26px',
  color: GOLD,
  margin: '0',
  fontWeight: 700,
  fontFamily: FONT_STACK_HEAD,
  letterSpacing: '0.02em',
}

// Highlight - Success (cream w green tick)
const highlightSuccess = {
  backgroundColor: SUCCESS_BG,
  border: `1px solid ${SUCCESS_BORDER}55`,
  borderRadius: '10px',
  padding: '18px',
  margin: '4px 0 18px',
  textAlign: 'center' as const,
}
const highlightSuccessLabel = {
  fontSize: '11px',
  color: SUCCESS_TEXT,
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  margin: '0 0 6px',
  fontWeight: 700,
}
const highlightSuccessValue = {
  fontSize: '17px',
  color: SUCCESS_TEXT,
  margin: '0',
  fontWeight: 700,
}

// Highlight - Danger
const highlightDanger = {
  backgroundColor: DANGER_BG,
  border: `1px solid ${DANGER_BORDER}55`,
  borderRadius: '10px',
  padding: '18px',
  margin: '4px 0 18px',
  textAlign: 'center' as const,
}
const highlightDangerLabel = {
  fontSize: '11px',
  color: DANGER_TEXT,
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  margin: '0 0 6px',
  fontWeight: 700,
}
const highlightDangerValue = {
  fontSize: '17px',
  color: DANGER_TEXT,
  margin: '0',
  fontWeight: 700,
}

// Highlight - Navy (subtle info box)
const highlightNavy = {
  backgroundColor: CREAM,
  border: `1px solid ${NAVY}22`,
  borderRadius: '10px',
  padding: '16px',
  margin: '4px 0 18px',
}
const highlightNavyLabel = {
  fontSize: '10px',
  color: NAVY,
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  margin: '0 0 6px',
  fontWeight: 700,
}
const highlightNavyValue = {
  fontSize: '14px',
  color: NAVY,
  margin: '0',
  fontWeight: 600,
  lineHeight: '1.5',
}

const highlightMeta = {
  fontSize: '12px',
  color: '#cfd4e4',
  margin: '8px 0 0',
}

// Buttons
const primaryButtonStyle = {
  backgroundColor: GOLD,
  backgroundImage: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`,
  color: NAVY,
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  padding: '13px 26px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
  border: `1px solid ${GOLD}`,
  fontFamily: FONT_STACK_BODY,
}

const secondaryButtonStyle = {
  backgroundColor: 'transparent',
  color: NAVY,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.05em',
  padding: '11px 22px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
  border: `1px solid ${NAVY}55`,
  fontFamily: FONT_STACK_BODY,
}

// Footer bar (in-card)
const footerBar = {
  backgroundColor: NAVY_DEEP,
  padding: '18px 24px 20px',
  borderTop: `1px solid ${GOLD}33`,
}
const footerLine = {
  fontSize: '12px',
  color: GOLD_LIGHT,
  margin: '4px 0',
  fontFamily: FONT_STACK_BODY,
  letterSpacing: '0.02em',
}
const footerIcon = {
  color: GOLD,
  marginRight: '8px',
  fontSize: '13px',
}
const footerLink = {
  color: GOLD_LIGHT,
  textDecoration: 'none',
  fontWeight: 500,
}

// Trust bar (outside card)
const trustBar = {
  padding: '18px 6px 8px',
  textAlign: 'center' as const,
}
const trustItem = {
  fontSize: '11px',
  color: TEXT_MUTED,
  margin: '2px 12px',
  display: 'inline-block',
  letterSpacing: '0.02em',
}
const trustGold = {
  color: GOLD,
  marginRight: '6px',
  fontSize: '9px',
}

const legal = {
  fontSize: '11px',
  color: '#8a92a6',
  margin: '10px 0 4px',
  textAlign: 'center' as const,
  lineHeight: '1.5',
}
const legalSmall = {
  fontSize: '10px',
  color: '#a4abbe',
  margin: '2px 0 0',
  textAlign: 'center' as const,
  fontStyle: 'italic' as const,
}

const divider = {
  borderColor: `${GOLD}44`,
  borderStyle: 'solid' as const,
  borderWidth: '0 0 1px 0',
  margin: '18px 0',
}
