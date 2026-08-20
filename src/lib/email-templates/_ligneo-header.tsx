import * as React from 'react'
import {
  LIGNEO_BRAND_BANNER_URL,
  LIGNEO_GOOGLE_REVIEW_URL,
  LIGNEO_LOGO_SQUARE_URL,
  LIGNEO_QR_AVIS_GOOGLE_URL,
} from '@/lib/brand-assets'
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
 * Gabarit email Transports Ligneo — v6 (charte site 2026).
 * Fond blanc forcé, carte blanche 600px, en-tête bleu marine dégradé,
 * accents bleu électrique / or, typographie Poppins avec repli Arial.
 *
 * Toutes les templates s'appuient sur ce composant : modifier ce fichier
 * harmonise l'intégralité des emails transactionnels du site.
 */

export const LIGNEO_SITE = 'Transports Ligneo'
export const LIGNEO_SITE_URL = 'www.transportsligneo.fr'
export const LIGNEO_TEL = '07 82 45 61 81'
export const LIGNEO_EMAIL = 'contact@transportsligneo.fr'
export const LIGNEO_LOGO_URL = 'https://transportsligneo.fr/logo-ligneo.png'

// Palette — miroir du site
const NAVY = '#0a1638'
const NAVY_2 = '#132a6b'
const BLUE = '#2f5fff'
const BLUE_LIGHT = '#6ea1ff'
const GOLD = '#b8862a'
const GOLD_LIGHT = '#e8c976'
const PAGE_BG = '#ffffff'
const CARD_BG = '#f7f9fc'
const CARD_BORDER = '#e7ebf3'
const TEXT_DARK = '#0f1526'
const TEXT_BODY = '#4b5468'
const TEXT_MUTED = '#9aa2ba'
const BORDER = '#eaeaee'
void NAVY_2
void BLUE_LIGHT

const FONT_STACK_HEAD = "'Poppins', 'Segoe UI', Arial, Helvetica, sans-serif"
const FONT_STACK_BODY = "'Inter', 'Segoe UI', Arial, Helvetica, sans-serif"

// ---------- SHELL ----------

export interface LigneoEmailShellProps {
  preview: string
  /** Petite étiquette en haut du contenu (ex: "Devis disponible"). */
  tagline?: string
  /** Titre principal. */
  title: string
  /** Icône emoji ou courte string affichée à gauche du titre. */
  icon?: string
  /** Salutation (ex: "Bonjour Jean,"). */
  greeting?: string
  /** Paragraphe d'intro sous le titre. */
  intro?: React.ReactNode
  /** Contenu additionnel (RecapCard, HighlightBox, etc.). */
  children?: React.ReactNode
  /** Bouton principal (bleu). */
  primaryCta?: { label: string; href: string } | null
  /** Bouton secondaire (or). */
  secondaryCta?: { label: string; href: string } | null
  /** Signature finale. */
  signature?: string
  /** URL du logo client (organisation). */
  clientLogoUrl?: string | null
  /** Nom du client / organisation. */
  clientName?: string | null
  /** Thème d'espace client — colorise le chip sous l'en-tête. */
  accountTheme?: 'flotte' | 'b2b' | 'default' | null
  /** Couleur de l'étiquette (ex: alerte orange). */
  taglineTone?: 'blue' | 'warn'
  /** Petit texte discret affiché sous les CTA (mentions, sécurité). */
  footnote?: React.ReactNode
  /** Affiche le bloc "Avis Google" au-dessus du pied de page. `true` = lien par défaut, ou URL personnalisée. */
  googleReview?: boolean | string | null

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
  clientLogoUrl,
  clientName,
  accountTheme,
  taglineTone,
  footnote,
  googleReview,

}: LigneoEmailShellProps) {
  const themeChip =
    accountTheme === 'flotte'
      ? { label: 'Espace Flotte partenaire', bg: '#f1ecfd', border: '#d9c9fb', color: '#5b2ea8' }
      : accountTheme === 'b2b'
        ? { label: 'Espace B2B Standard', bg: '#eef2ff', border: '#d5deff', color: '#1c3fc4' }
        : null

  return (
    <Html lang="fr" dir="ltr">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={outerContainer}>
          <Section style={card}>
            {/* En-tête de marque — HTML pur : s'affiche même si les images
                sont bloquées (IONOS, Outlook, Gmail mode "images masquées"). */}
            <BrandHeaderBlock />



            {clientLogoUrl || clientName || themeChip ? (
              <Section style={clientBrandBar}>
                {clientLogoUrl ? (
                  <img src={clientLogoUrl} alt={clientName || 'Logo client'} style={clientBrandLogo} />
                ) : null}
                {clientName ? <Text style={clientBrandName}>{clientName}</Text> : null}
                {themeChip ? (
                  <Text
                    style={{
                      display: 'inline-block',
                      margin: '6px 0 0',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      backgroundColor: themeChip.bg,
                      border: `1px solid ${themeChip.border}`,
                      color: themeChip.color,
                      fontSize: '10.5px',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      fontFamily: FONT_STACK_BODY,
                    }}
                  >
                    {themeChip.label}
                  </Text>
                ) : null}
              </Section>
            ) : null}

            {/* Contenu */}
            <Section style={contentWrap}>
              {tagline ? (
                <Text style={taglineTone === 'warn' ? { ...eyebrowStyle, color: '#c07d1f' } : eyebrowStyle}>
                  {tagline}
                </Text>
              ) : null}
              <Text style={titleStyle}>
                {icon ? <span style={{ marginRight: 8 }}>{icon}</span> : null}
                {title}
              </Text>

              {greeting ? <Text style={greetingStyle}>{greeting}</Text> : null}
              {intro ? <Text style={introStyle}>{intro}</Text> : null}

              {children}

              {primaryCta ? (
                <Section style={{ margin: '8px 0 20px' }}>
                  <Button href={primaryCta.href} style={primaryButtonStyle}>
                    {primaryCta.label}
                  </Button>
                </Section>
              ) : null}
              {secondaryCta ? (
                <Section style={{ margin: '0 0 20px' }}>
                  <Button href={secondaryCta.href} style={secondaryButtonStyle}>
                    {secondaryCta.label}
                  </Button>
                </Section>
              ) : null}

              {footnote ? <Text style={footnoteStyle}>{footnote}</Text> : null}

              <Text style={signatureStyle}>
                {(signature || `Cordialement,\nL'équipe ${LIGNEO_SITE}`)
                  .replace(/\\n/g, '\n')
                  .split('\n')
                  .map((line, i) => (
                    <React.Fragment key={i}>
                      {i > 0 ? <br /> : null}
                      {line}
                    </React.Fragment>
                  ))}
              </Text>
            </Section>

            {/* Bloc "Avis Google" (devis, facture, rapport EDL) */}
            {googleReview ? <GoogleReviewBlock url={typeof googleReview === 'string' ? googleReview : undefined} /> : null}

            {/* Pied de page */}

            <Section style={footerBar}>
              <Hr style={divider} />
              <Text style={footerLine}>
                <b style={{ color: TEXT_BODY }}>{LIGNEO_SITE}</b> — Convoyage automobile — Basé à Tours (37)
              </Text>
              <Text style={footerLine}>
                {LIGNEO_TEL} ·{' '}
                <a href={`mailto:${LIGNEO_EMAIL}`} style={footerLink}>
                  {LIGNEO_EMAIL}
                </a>{' '}
                ·{' '}
                <a href={`https://${LIGNEO_SITE_URL.replace('www.', '')}`} style={footerLink}>
                  transportsligneo.fr
                </a>
              </Text>
              <Text style={{ ...footerLine, marginTop: '12px' }}>
                Vous recevez cet email suite à une action sur votre compte Transports Ligneo.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ---------- Ancien header (backward compat) ----------

export function LigneoEmailHeader({ tagline }: { tagline?: string }) {
  return (
    <Section style={headerSection}>
      <img
        src={LIGNEO_BRAND_BANNER_URL}
        width="600"
        alt="Transports Ligneo"
        style={{ display: 'block', width: '100%', maxWidth: '600px', height: 'auto', border: 0 }}
      />
      {tagline ? <Text style={{ ...eyebrowStyle, padding: '10px 32px 0' }}>{tagline}</Text> : null}
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
  const box =
    tone === 'success'
      ? { bg: '#e9f7ee', border: '#c3e8d0', color: '#186a34' }
      : tone === 'danger'
        ? { bg: '#fdeaea', border: '#f3bcbc', color: '#a3231b' }
        : tone === 'navy'
          ? { bg: '#eef2ff', border: '#d5deff', color: '#1c3fc4' }
          : { bg: '#fef3e2', border: '#f3d9b0', color: '#8a5f13' }

  return (
    <Section
      style={{
        backgroundColor: box.bg,
        border: `1px solid ${box.border}`,
        borderRadius: '12px',
        padding: '18px 20px',
        margin: '0 0 20px',
      }}
    >
      {label ? (
        <Text
          style={{
            fontFamily: FONT_STACK_BODY,
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: box.color,
            margin: '0 0 6px',
          }}
        >
          {label}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: FONT_STACK_HEAD,
          fontSize: '18px',
          fontWeight: 700,
          color: box.color,
          margin: 0,
          lineHeight: '1.35',
        }}
      >
        {value}
      </Text>
      {meta ? (
        <Text style={{ fontFamily: FONT_STACK_BODY, fontSize: '13px', color: TEXT_BODY, margin: '6px 0 0' }}>
          {meta}
        </Text>
      ) : null}
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
  padding: '32px 8px',
  fontFamily: FONT_STACK_BODY,
  color: TEXT_DARK,
  backgroundImage: `linear-gradient(${PAGE_BG}, ${PAGE_BG})`,
  colorScheme: 'light only',
}

const outerContainer = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: 0,
}

const card = {
  backgroundColor: '#ffffff',
  backgroundImage: 'linear-gradient(#ffffff, #ffffff)',
  borderRadius: '16px',
  overflow: 'hidden' as const,
  border: `1px solid ${CARD_BORDER}`,
  padding: 0,
}

const headerSection = {
  backgroundColor: '#0b1026',
  backgroundImage: 'linear-gradient(#0b1026, #0b1026)',
  borderBottom: `1px solid ${CARD_BORDER}`,
  padding: 0,
}

const brandCell = {
  fontFamily: FONT_STACK_HEAD,
  fontWeight: 800,
  fontSize: '16px',
  color: NAVY,
  letterSpacing: '0.02em',
  verticalAlign: 'middle' as const,
  paddingLeft: '12px',
  margin: 0,
}

const clientBrandBar = {
  backgroundColor: CARD_BG,
  backgroundImage: `linear-gradient(${CARD_BG}, ${CARD_BG})`,
  borderBottom: `1px solid ${CARD_BORDER}`,
  padding: '12px 32px',
  textAlign: 'center' as const,
}

const clientBrandLogo = {
  maxHeight: '30px',
  maxWidth: '140px',
  display: 'inline-block',
  verticalAlign: 'middle',
  backgroundColor: '#ffffff',
  padding: '3px 6px',
  borderRadius: '6px',
  border: `1px solid ${CARD_BORDER}`,
}

const clientBrandName = {
  fontSize: '11px',
  color: TEXT_MUTED,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  margin: '6px 0 0',
  fontFamily: FONT_STACK_BODY,
  fontWeight: 700,
}

const contentWrap = {
  backgroundColor: '#ffffff',
  backgroundImage: 'linear-gradient(#ffffff, #ffffff)',
  padding: '36px 32px 8px',
  fontFamily: FONT_STACK_BODY,
}

const eyebrowStyle = {
  fontFamily: FONT_STACK_BODY,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: BLUE,
  margin: '0 0 12px',
}

const titleStyle = {
  fontFamily: FONT_STACK_HEAD,
  fontSize: '22px',
  fontWeight: 800,
  color: TEXT_DARK,
  margin: '0 0 16px',
  lineHeight: '1.3',
}

const greetingStyle = {
  fontSize: '14px',
  color: TEXT_DARK,
  margin: '0 0 12px',
  fontWeight: 600,
  lineHeight: '1.6',
}

const introStyle = {
  fontSize: '14px',
  color: TEXT_BODY,
  lineHeight: '1.65',
  margin: '0 0 16px',
}

const primaryButtonStyle = {
  display: 'inline-block',
  backgroundColor: '#0066ff',
  backgroundImage: 'linear-gradient(#0066ff, #0066ff)',
  color: '#ffffff',
  fontFamily: FONT_STACK_BODY,
  fontWeight: 700,
  fontSize: '14px',
  padding: '14px 28px',
  borderRadius: '10px',
  textDecoration: 'none',
}

const secondaryButtonStyle = {
  display: 'inline-block',
  backgroundColor: GOLD,
  backgroundImage: `linear-gradient(120deg, ${GOLD_LIGHT}, ${GOLD})`,
  color: '#ffffff',
  fontFamily: FONT_STACK_BODY,
  fontWeight: 700,
  fontSize: '14px',
  padding: '14px 28px',
  borderRadius: '10px',
  textDecoration: 'none',
}

const signatureStyle = {
  fontSize: '13.5px',
  color: TEXT_BODY,
  lineHeight: '1.6',
  margin: '20px 0 4px',
  whiteSpace: 'pre-line' as const,
}

const footerBar = {
  backgroundColor: '#ffffff',
  backgroundImage: 'linear-gradient(#ffffff, #ffffff)',
  padding: '8px 32px 32px',
  fontFamily: FONT_STACK_BODY,
}

const footerLine = {
  fontSize: '11.5px',
  color: TEXT_MUTED,
  margin: '0 0 6px',
  lineHeight: '1.6',
}

const footerLink = {
  color: BLUE,
  textDecoration: 'none',
}

const divider = {
  borderTop: `1px solid ${BORDER}`,
  borderBottom: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  margin: '24px 0',
}

const recapCard = {
  backgroundColor: CARD_BG,
  backgroundImage: `linear-gradient(${CARD_BG}, ${CARD_BG})`,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: '12px',
  padding: '18px 20px',
  margin: '0 0 20px',
}

const recapTitle = {
  fontFamily: FONT_STACK_HEAD,
  fontSize: '14px',
  fontWeight: 700,
  color: TEXT_DARK,
  margin: '0 0 10px',
}

const recapTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
}

const recapLabel = {
  fontFamily: FONT_STACK_BODY,
  fontSize: '10.5px',
  fontWeight: 700,
  color: TEXT_MUTED,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  padding: '6px 12px 6px 0',
  verticalAlign: 'top' as const,
  whiteSpace: 'nowrap' as const,
}

const recapValue = {
  fontFamily: FONT_STACK_BODY,
  fontSize: '14px',
  fontWeight: 600,
  color: TEXT_DARK,
  padding: '6px 0',
  textAlign: 'right' as const,
}

const footnoteStyle = {
  fontSize: '12.5px',
  color: TEXT_MUTED,
  lineHeight: '1.6',
  margin: '0 0 8px',
  fontFamily: FONT_STACK_BODY,
}

// ---------- Carte simple (titre + sous-titre) ----------

export function SimpleCard({
  title,
  subtitle,
  tone = 'default',
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  tone?: 'default' | 'warn'
}) {
  const bg = tone === 'warn' ? '#fef3e2' : CARD_BG
  const border = tone === 'warn' ? '#f3d9b0' : CARD_BORDER
  return (
    <Section
      style={{
        ...recapCard,
        backgroundColor: bg,
        backgroundImage: `linear-gradient(${bg}, ${bg})`,
        border: `1px solid ${border}`,
      }}
    >
      {title ? (
        <Text
          style={{
            fontFamily: FONT_STACK_BODY,
            fontSize: '14px',
            fontWeight: 700,
            color: TEXT_DARK,
            margin: '0 0 4px',
            lineHeight: '1.45',
          }}
        >
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={{ fontFamily: FONT_STACK_BODY, fontSize: '13px', color: '#70727d', margin: 0, lineHeight: '1.55' }}>
          {subtitle}
        </Text>
      ) : null}
    </Section>
  )
}

// ---------- Code à usage unique ----------

export function CodeBox({ code }: { code: string }) {
  return (
    <Section style={{ ...recapCard, textAlign: 'center' as const }}>
      <Text
        style={{
          fontFamily: FONT_STACK_HEAD,
          fontSize: '32px',
          fontWeight: 800,
          color: TEXT_DARK,
          letterSpacing: '0.15em',
          margin: 0,
        }}
      >
        {code}
      </Text>
    </Section>
  )
}

// ---------- Ligne montant (label + gros montant doré) ----------

export function AmountRow({ label = 'Montant TTC', amount }: { label?: string; amount: React.ReactNode }) {
  return (
    <Section style={{ margin: '0 0 20px' }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={recapTable}>
        <tbody>
          <tr>
            <td style={recapLabel}>{label}</td>
            <td
              align="right"
              style={{
                fontFamily: FONT_STACK_HEAD,
                fontSize: '24px',
                fontWeight: 800,
                color: GOLD,
              }}
            >
              {amount}
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

void brandCell

// ---------- Bloc "Avis Google" (pied de page emails clients) ----------

export function GoogleReviewBlock({ url }: { url?: string }) {
  const href = url || LIGNEO_GOOGLE_REVIEW_URL
  return (
    <Section style={{ padding: '0 28px' }}>
      <Hr style={{ borderColor: BORDER, borderWidth: '1px 0 0', margin: '4px 0 14px' }} />
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        width="100%"
        style={{ backgroundColor: '#ffffff', borderCollapse: 'collapse' }}
      >
        <tbody>
          <tr>
            <td width="46" style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
              <img
                src={LIGNEO_LOGO_SQUARE_URL}
                width="46"
                height="46"
                alt="Transports Ligneo"
                style={{ display: 'block', width: '46px', height: '46px', borderRadius: '10px', border: 0 }}
              />
            </td>
            <td style={{ verticalAlign: 'middle' }}>
              <p
                style={{
                  margin: '0 0 4px',
                  fontFamily: FONT_STACK_HEAD,
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#2f5fff',
                  textShadow: '0 0 10px rgba(79,140,255,0.45)',
                }}
              >
                Votre avis compte pour nous
              </p>
              <p style={{ margin: 0, fontFamily: FONT_STACK_BODY, fontSize: '12px', lineHeight: '18px', color: TEXT_MUTED }}>
                Scannez ce code ou{' '}
                <a href={href} style={{ color: '#4f8cff', textDecoration: 'underline' }}>
                  cliquez ici
                </a>{' '}
                pour laisser un avis Google. Ça prend 30 secondes.
              </p>
            </td>
            <td width="110" style={{ verticalAlign: 'middle', paddingLeft: '12px', textAlign: 'right' }}>
              {/* Emplacement QR code — remplacer LIGNEO_QR_AVIS_GOOGLE_URL pour changer l'image */}
              <a href={href}>
                <img
                  src={LIGNEO_QR_AVIS_GOOGLE_URL}
                  width="110"
                  height="110"
                  alt="QR code avis Google Transports Ligneo"
                  style={{ display: 'block', width: '110px', height: '110px', maxWidth: '110px', border: 0, borderRadius: '8px' }}
                />
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}
