/**
 * Rendu HTML des emails de campagne marketing Transports Ligneo.
 *
 * Reprend l'en-tête navy + bannière de marque des emails transactionnels,
 * et gère : variables, réécriture des liens (tracking clic), pixel d'ouverture
 * et lien de désinscription RGPD.
 */
import { LIGNEO_BRAND_BANNER_URL, LIGNEO_SITE_ORIGIN } from '@/lib/brand-assets'

export const CAMPAIGN_VARIABLES = [
  { token: '{{prenom}}', label: 'Prénom' },
  { token: '{{nom}}', label: 'Nom' },
  { token: '{{entreprise}}', label: 'Entreprise' },
  { token: '{{solde_km}}', label: 'Solde km' },
] as const

export interface CampaignContent {
  subject?: string | null
  sender_name?: string | null
  title?: string | null
  message?: string | null
  cta_text?: string | null
  cta_url?: string | null
  visual_url?: string | null
  preheader?: string | null
}

export interface CampaignVars {
  prenom?: string | null
  nom?: string | null
  entreprise?: string | null
  solde_km?: number | string | null
}

export function applyVariables(input: string, vars: CampaignVars): string {
  return (input || '')
    .replaceAll('{{prenom}}', vars.prenom || '')
    .replaceAll('{{nom}}', vars.nom || '')
    .replaceAll('{{entreprise}}', vars.entreprise || '')
    .replaceAll('{{solde_km}}', vars.solde_km == null ? '0' : String(vars.solde_km))
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Convertit le message texte en paragraphes HTML sûrs. */
function messageToHtml(message: string): string {
  return message
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#4b5468;">${escapeHtml(
          block,
        ).replace(/\n/g, '<br />')}</p>`,
    )
    .join('')
}

export function trackClickUrl(baseUrl: string, recipientId: string, target: string): string {
  return `${baseUrl}/api/public/track-click?rid=${encodeURIComponent(recipientId)}&url=${encodeURIComponent(target)}`
}

export function trackOpenUrl(baseUrl: string, recipientId: string): string {
  return `${baseUrl}/api/public/track-open?rid=${encodeURIComponent(recipientId)}`
}

export function unsubscribeUrl(baseUrl: string, recipientId: string): string {
  return `${baseUrl}/desinscription?rid=${encodeURIComponent(recipientId)}`
}

/** Réécrit tous les href http(s) du HTML pour passer par le tracking de clics. */
export function rewriteLinks(html: string, baseUrl: string, recipientId: string): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url: string) => {
    if (url.includes('/api/public/track-click') || url.includes('/desinscription')) return match
    return `href="${trackClickUrl(baseUrl, recipientId, url)}"`
  })
}

export interface BuildCampaignHtmlOptions {
  campaign: CampaignContent
  vars?: CampaignVars
  /** Identifiant destinataire — active pixel, tracking clics et désinscription. */
  recipientId?: string | null
  baseUrl?: string
}

export function buildCampaignHtml({
  campaign,
  vars = {},
  recipientId,
  baseUrl = LIGNEO_SITE_ORIGIN,
}: BuildCampaignHtmlOptions): string {
  const title = applyVariables(campaign.title || '', vars)
  const message = applyVariables(campaign.message || '', vars)
  const preheader = applyVariables(campaign.preheader || campaign.subject || '', vars)
  const ctaText = applyVariables(campaign.cta_text || '', vars)
  const ctaUrl = (campaign.cta_url || '').trim()
  const visual = (campaign.visual_url || '').trim()
  const unsubHref = recipientId
    ? unsubscribeUrl(baseUrl, recipientId)
    : `${baseUrl}/desinscription`

  const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${escapeHtml(applyVariables(campaign.subject || 'Transports Ligneo', vars))}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>body,table,td,p,h1,h2,h3,a,span,div{font-family:'Poppins','Segoe UI',Arial,sans-serif !important;}</style>
</head>
<body style="margin:0; padding:0; background:#eef0f5; -webkit-font-smoothing:antialiased; font-family:'Poppins','Segoe UI',Arial,sans-serif;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f5;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background:#ffffff; border-radius:14px; overflow:hidden; font-family:'Poppins','Segoe UI',Arial,sans-serif;">

    <tr>
      <td style="background:#0a1638; padding:0; text-align:center;">
        <img src="${LIGNEO_BRAND_BANNER_URL}" width="600" alt="Transports Ligneo" style="display:block; width:100%; max-width:600px; border:0;" />
      </td>
    </tr>
    ${
      visual
        ? `<tr><td style="padding:0;"><img src="${escapeHtml(visual)}" width="600" alt="" style="display:block; width:100%; max-width:600px; border:0;" /></td></tr>`
        : ''
    }
    <tr>
      <td style="padding:32px 32px 8px;">
        <h1 style="margin:0 0 16px; font-family:'Poppins','Segoe UI',Arial,sans-serif; font-size:26px; line-height:1.25; color:#0f1526; font-weight:700;">${escapeHtml(title)}</h1>
        ${messageToHtml(message)}
      </td>
    </tr>
    ${
      ctaText && ctaUrl
        ? `<tr><td align="center" style="padding:8px 32px 32px;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block; background:#2f5fff; color:#ffffff; font-weight:700; font-size:15px; padding:14px 28px; border-radius:10px; font-family:'Poppins','Segoe UI',Arial,sans-serif;">${escapeHtml(ctaText)}</a>
          </td></tr>`
        : '<tr><td style="height:16px;"></td></tr>'
    }
    <tr>
      <td style="background:#f7f9fc; border-top:1px solid #e7ebf3; padding:22px 32px; text-align:center;">
        <p style="margin:0 0 6px; font-size:12px; color:#9aa2ba;">Transports Ligneo — convoyage de véhicules par la route</p>
        <p style="margin:0 0 10px; font-size:12px; color:#9aa2ba;">
          <a href="${LIGNEO_SITE_ORIGIN}" style="color:#2f5fff; text-decoration:none;">transportsligneo.fr</a>
          &nbsp;•&nbsp; contact@transportsligneo.fr
        </p>
        <p style="margin:0; font-size:11px; color:#9aa2ba;">
          Vous recevez cet email car vous êtes client de Transports Ligneo.
          <a href="${escapeHtml(unsubHref)}" style="color:#9aa2ba; text-decoration:underline;">Se désinscrire</a>
        </p>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>`

  if (!recipientId) return body
  const tracked = rewriteLinks(body, baseUrl, recipientId)
  return tracked.replace(
    '</body>',
    `<img src="${trackOpenUrl(baseUrl, recipientId)}" width="1" height="1" alt="" style="display:block;border:0;" /></body>`,
  )
}

/** Version texte brut, pour les clients mail sans HTML. */
export function buildCampaignText(campaign: CampaignContent, vars: CampaignVars = {}): string {
  const parts = [
    applyVariables(campaign.title || '', vars),
    '',
    applyVariables(campaign.message || '', vars),
  ]
  if (campaign.cta_text && campaign.cta_url) {
    parts.push('', `${applyVariables(campaign.cta_text, vars)} : ${campaign.cta_url}`)
  }
  parts.push('', 'Transports Ligneo — transportsligneo.fr')
  return parts.join('\n')
}
