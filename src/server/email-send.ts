// Server-side helper to send transactional emails WITHOUT requiring a user JWT.
// Use this from webhooks, public server routes, and other trusted server contexts.
// Delivery, retries, suppression and unsubscribe are handled by Lovable.
import { EmailAPIError, sendLovableEmail } from '@lovable.dev/email-js'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = "transportsligneo"
const SENDER_DOMAIN = "notify.transportsligneo.fr"
const FROM_DOMAIN = "notify.transportsligneo.fr"

async function logSend(row: {
  message_id: string
  template_name: string
  recipient_email: string
  status: 'sent' | 'suppressed' | 'failed'
  error_message?: string
}) {
  const { error } = await supabaseAdmin.from('email_send_log').insert(row)
  if (error) {
    console.error('[email/server] send log write failed', { code: error.code, message: error.message })
  }
}

function isSuppressed(error: unknown): boolean {
  return error instanceof EmailAPIError && error.code === 'recipient_suppressed'
}

async function waitForRateLimit(error: unknown): Promise<boolean> {
  if (error instanceof EmailAPIError && error.status === 429) {
    const seconds = error.retryAfterSeconds ?? 60
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
    return true
  }
  return false
}

interface Params {
  templateName: string
  recipientEmail?: string // optional if template has fixed `to`
  idempotencyKey?: string
  templateData?: Record<string, any>
}

/**
 * Injecte le lien public sécurisé (signature + paiement) dans les emails de devis.
 * Le token est non devinable : il remplace l'ID du devis dans l'URL.
 */
async function withDevisPublicLinks(params: Params): Promise<Record<string, any>> {
  const data = { ...(params.templateData ?? {}) }
  if (params.templateName !== 'devis-client') return data
  if (data['signUrl']) return data
  const numero = data['numero']
  if (!numero) return data
  try {
    const { data: row } = await supabaseAdmin
      .from('devis')
      .select('public_token, lien_paiement_externe')
      .eq('numero', String(numero))
      .maybeSingle()
    const token = (row as { public_token?: string } | null)?.public_token
    const mod = await import('@/lib/devis-public.server')
    const externe = mod.sanitizePaymentLink(
      (row as { lien_paiement_externe?: string | null } | null)?.lien_paiement_externe,
    )
    if (!token) {
      // Lien bancaire externe utilisable même sans lien de signature.
      if (externe) data['payUrl'] = externe
      return data
    }
    const url = mod.devisPublicUrl(token)
    data['signUrl'] = url
    data['payUrl'] = externe ?? `${url}#paiement`
  } catch (e) {
    console.error('[email/server] devis public link lookup failed')
  }
  return data
}

export async function sendTransactionalEmailServer(params: Params): Promise<{ success: boolean; reason?: string }> {
  const template = TEMPLATES[params.templateName]
  if (!template) {
    console.error('[email/server] template not found', params.templateName)
    return { success: false, reason: 'template_not_found' }
  }

  const effectiveRecipient = template.to || params.recipientEmail
  if (!effectiveRecipient) {
    console.error('[email/server] no recipient resolved', params.templateName)
    return { success: false, reason: 'no_recipient' }
  }

  const templateData = await withDevisPublicLinks(params)

  const messageId = crypto.randomUUID()

  const send = () =>
    sendTemplateEmail(params.templateName, effectiveRecipient, {
      templateData,
      idempotencyKey: params.idempotencyKey || messageId,
    })


  try {
    let result
    try {
      result = await send()
    } catch (error) {
      if (await waitForRateLimit(error)) result = await send()
      else throw error
    }

    if (!result.sent) {
      await logSend({
        message_id: messageId,
        template_name: params.templateName,
        recipient_email: effectiveRecipient,
        status: 'suppressed',
      })
      return { success: false, reason: 'email_suppressed' }
    }

    await logSend({
      message_id: messageId,
      template_name: params.templateName,
      recipient_email: effectiveRecipient,
      status: 'sent',
    })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'send failed'
    console.error('[email/server] send failed', message)
    await logSend({
      message_id: messageId,
      template_name: params.templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: message,
    })
    return { success: false, reason: 'send_failed' }
  }
}

/** Resolve admin notification email: first active admin in user_roles, else fallback. */
export async function getAdminNotificationEmail(): Promise<string> {
  const FALLBACK = 'contact@transportsligneo.fr'
  try {
    const { data: roles } = await supabaseAdmin
      .from('user_roles').select('user_id').eq('role', 'admin').eq('actif', true).limit(1)
    const userId = roles?.[0]?.user_id
    if (!userId) return FALLBACK
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('email').eq('user_id', userId).maybeSingle()
    if (profile?.email && profile.email.includes('@')) return profile.email
    // Fallback to auth.users via admin API
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    return authUser?.user?.email ?? FALLBACK
  } catch (e) {
    console.error('[email/server] resolve admin email failed', e)
    return FALLBACK
  }
}

/**
 * Envoi d'un email HTML "brut" (campagnes, envoi direct) via l'API email Lovable.
 * Utilise le domaine expéditeur vérifié (notify.transportsligneo.fr).
 */
export async function sendRawEmailServer(params: {
  to: string
  subject: string
  html: string
  text?: string
  senderName?: string | null
  label?: string
  purpose?: 'transactional' | 'marketing'
  idempotencyKey?: string
}): Promise<{ success: boolean; reason?: string }> {
  const to = params.to.trim()
  const normalizedEmail = to.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(normalizedEmail)) {
    return { success: false, reason: 'invalid_recipient' }
  }

  const apiKey = process.env['LOVABLE_API_KEY']
  if (!apiKey) {
    console.error('[email/server] LOVABLE_API_KEY is not configured')
    return { success: false, reason: 'send_failed' }
  }

  const messageId = crypto.randomUUID()
  const label = params.label || 'direct_email'
  const senderName = (params.senderName || SITE_NAME).replace(/[<>"]/g, '').trim() || SITE_NAME

  const send = () =>
    sendLovableEmail(
      {
        to,
        from: `${senderName} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: params.subject,
        html: params.html,
        text: params.text ?? '',
        purpose: 'transactional',
        label,
        idempotency_key: params.idempotencyKey || messageId,
      },
      { apiKey, sendUrl: process.env['LOVABLE_SEND_URL'] }
    )

  try {
    try {
      await send()
    } catch (error) {
      if (await waitForRateLimit(error)) await send()
      else throw error
    }
    await logSend({ message_id: messageId, template_name: label, recipient_email: to, status: 'sent' })
    return { success: true }
  } catch (error) {
    if (isSuppressed(error)) {
      await logSend({ message_id: messageId, template_name: label, recipient_email: to, status: 'suppressed' })
      return { success: false, reason: 'email_suppressed' }
    }
    const message = error instanceof Error ? error.message : 'send failed'
    console.error('[email/server] raw send failed', message)
    await logSend({
      message_id: messageId,
      template_name: label,
      recipient_email: to,
      status: 'failed',
      error_message: message,
    })
    return { success: false, reason: 'send_failed' }
  }
}
