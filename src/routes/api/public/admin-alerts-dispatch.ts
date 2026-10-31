import { buildAlertDetails } from '@/lib/admin-alert-details'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { sendTransactionalEmailServer } from '@/server/email-send'
import { sbServerUrl, sbServiceRoleKey } from "@/integrations/supabase/env";

/**
 * Envoi des alertes email à l'équipe admin.
 *
 * Appelée toutes les 2 minutes par le planificateur interne avec l'en-tête
 * `x-alert-secret`. Parcourt les notifications admin créées automatiquement
 * (nouvelle demande, devis, message de contact, demande B2B, lead flotte)
 * qui n'ont pas encore été notifiées par email, et envoie une alerte à chaque
 * destinataire configuré dans les réglages `admin_alert_emails`.
 *
 * Idempotent : chaque notification est estampillée `email_sent_at` après envoi.
 */

const MAX_BATCH = 25
const MAX_AGE_HOURS = 24

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })

const LABELS: Record<string, string> = {
  demande: 'Demande de convoyage',
  devis: 'Devis',
  message: 'Message de contact',
  b2b: 'Demande professionnelle',
}

/**
 * Push (appli native + navigateur) vers tous les admins et super admins, pour chaque
 * notification admin pas encore poussée. Indépendant des emails : un échec d'un côté
 * ne bloque jamais l'autre. Idempotent grâce à `push_sent_at`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dispatchPush(supabase: any) {
  try {
    const since = new Date(Date.now() - MAX_AGE_HOURS * 3_600_000).toISOString()
    const { data: pending, error } = await supabase
      .from('admin_notifications')
      .select('id, titre, message, link')
      .is('push_sent_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(MAX_BATCH)
    if (error || !pending?.length) return { push: 0, error: error?.message }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'super_admin'])
      .eq('actif', true)
    const userIds: string[] = [...new Set<string>((roles ?? []).map((r: { user_id: string }) => r.user_id))]
    if (!userIds.length) return { push: 0 }

    const { sendPushToUser } = await import('@/lib/push/send.server')
    let done = 0
    for (const n of pending as Array<{ id: string; titre: string; message: string | null; link: string | null }>) {
      const url = n.link && n.link.startsWith('/') ? n.link : '/admin/notifications'
      const payload = { title: (n.titre || 'Transports Ligneo').slice(0, 120), body: n.message?.slice(0, 300) ?? undefined, url, tag: `admin-notif-${n.id}` }
      await Promise.allSettled(userIds.map((uid) => sendPushToUser(uid, payload)))
      await supabase.from('admin_notifications').update({ push_sent_at: new Date().toISOString() }).eq('id', n.id)
      done += 1
    }
    return { push: done }
  } catch (e) {
    console.warn('[admin-alerts-dispatch] push', e)
    return { push: 0 }
  }
}

async function handle(request: Request) {
  const supabaseUrl = sbServerUrl()
  const serviceKey = sbServiceRoleKey()
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: secretRow } = await supabase
    .from('api_internal_config')
    .select('value')
    .eq('key', 'admin_alert_secret')
    .maybeSingle()

  const provided = request.headers.get('x-alert-secret')
  const expected = (secretRow as { value?: string } | null)?.value
  if (!expected || !provided || provided !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }

  const pushResult = await dispatchPush(supabase)

  const { data: settingRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'admin_alert_emails')
    .maybeSingle()

  const setting = ((settingRow as { value?: unknown } | null)?.value ?? {}) as {
    enabled?: boolean
    emails?: string[]
  }
  if (setting.enabled === false) return Response.json({ skipped: 'disabled', ...pushResult })

  const recipients = (setting.emails ?? []).filter((e) => typeof e === 'string' && e.includes('@'))
  if (!recipients.length) return Response.json({ skipped: 'no_recipients', ...pushResult })

  const since = new Date(Date.now() - MAX_AGE_HOURS * 3_600_000).toISOString()
  const { data: pending, error } = await supabase
    .from('admin_notifications')
    .select('id, type, titre, message, link, entity_type, metadata, created_at')
    .is('email_sent_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(MAX_BATCH)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!pending?.length) return Response.json({ sent: 0, ...pushResult })

  let sent = 0
  for (const notif of pending as Array<Record<string, any>>) {
    const meta = (notif.metadata ?? {}) as Record<string, unknown>
    const details = buildAlertDetails(meta)

    for (const to of recipients) {
      await sendTransactionalEmailServer({
        templateName: 'alerte-admin',
        recipientEmail: to,
        idempotencyKey: `admin-alert-${notif.id}-${to}`,
        templateData: {
          titre: notif.titre,
          message: notif.message,
          categorie: LABELS[notif.type as string] ?? 'Activité plateforme',
          lien: `https://transportsligneo.fr${notif.link ?? '/admin'}`,
          recu_le: fmtDate(notif.created_at as string),
          details,
        },
      })
    }

    await supabase
      .from('admin_notifications')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', notif.id)
    sent += 1
  }

  return Response.json({ sent, recipients: recipients.length, ...pushResult })
}

export const Route = createFileRoute('/api/public/admin-alerts-dispatch')({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      GET: ({ request }) => handle(request),
    },
  },
})
