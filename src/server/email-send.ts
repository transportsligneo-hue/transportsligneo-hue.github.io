// Server-side helper to send transactional emails WITHOUT requiring a user JWT.
// Use this from webhooks, public server routes, and other trusted server contexts.
// Mirrors the logic of /lovable/email/transactional/send but bypasses auth.
import * as React from 'react'
import { render } from '@react-email/components'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = "transportsligneo"
const SENDER_DOMAIN = "notify.transportsligneo.fr"
const FROM_DOMAIN = "notify.transportsligneo.fr"

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface Params {
  templateName: string
  recipientEmail?: string // optional if template has fixed `to`
  idempotencyKey?: string
  templateData?: Record<string, any>
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

  const messageId = crypto.randomUUID()
  const idempotencyKey = params.idempotencyKey || messageId
  const normalizedEmail = effectiveRecipient.toLowerCase()

  // Suppression check
  const { data: suppressed } = await supabaseAdmin
    .from('suppressed_emails').select('id').eq('email', normalizedEmail).maybeSingle()
  if (suppressed) {
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId, template_name: params.templateName,
      recipient_email: effectiveRecipient, status: 'suppressed',
    })
    return { success: false, reason: 'email_suppressed' }
  }

  // Unsubscribe token (one per email)
  let unsubscribeToken: string
  const { data: existingToken } = await supabaseAdmin
    .from('email_unsubscribe_tokens').select('token, used_at').eq('email', normalizedEmail).maybeSingle()
  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    const newToken = generateToken()
    await supabaseAdmin.from('email_unsubscribe_tokens')
      .upsert({ token: newToken, email: normalizedEmail }, { onConflict: 'email', ignoreDuplicates: true })
    const { data: stored } = await supabaseAdmin
      .from('email_unsubscribe_tokens').select('token').eq('email', normalizedEmail).maybeSingle()
    unsubscribeToken = stored?.token ?? newToken
  } else {
    return { success: false, reason: 'email_suppressed' }
  }

  const data = params.templateData ?? {}
  const element = React.createElement(template.component, data)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject = typeof template.subject === 'function' ? template.subject(data) : template.subject

  await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId, template_name: params.templateName,
    recipient_email: effectiveRecipient, status: 'pending',
  })

  const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: params.templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('[email/server] enqueue failed', enqueueError)
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId, template_name: params.templateName,
      recipient_email: effectiveRecipient, status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return { success: false, reason: 'enqueue_failed' }
  }

  return { success: true }
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
