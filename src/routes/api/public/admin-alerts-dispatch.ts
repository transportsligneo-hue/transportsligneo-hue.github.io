import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { sendTransactionalEmailServer } from '@/server/email-send'

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

async function handle(request: Request) {
  const supabaseUrl = process.env['SUPABASE_URL'] ?? import.meta.env.VITE_SUPABASE_URL
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
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

  const { data: settingRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'admin_alert_emails')
    .maybeSingle()

  const setting = ((settingRow as { value?: unknown } | null)?.value ?? {}) as {
    enabled?: boolean
    emails?: string[]
  }
  if (setting.enabled === false) return Response.json({ skipped: 'disabled' })

  const recipients = (setting.emails ?? []).filter((e) => typeof e === 'string' && e.includes('@'))
  if (!recipients.length) return Response.json({ skipped: 'no_recipients' })

  const since = new Date(Date.now() - MAX_AGE_HOURS * 3_600_000).toISOString()
  const { data: pending, error } = await supabase
    .from('admin_notifications')
    .select('id, type, titre, message, link, entity_type, metadata, created_at')
    .is('email_sent_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(MAX_BATCH)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!pending?.length) return Response.json({ sent: 0 })

  let sent = 0
  for (const notif of pending as Array<Record<string, any>>) {
    const meta = (notif.metadata ?? {}) as Record<string, unknown>
    const details = Object.entries(meta)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .slice(0, 8)
      .map(([k, v]) => ({ label: k.charAt(0).toUpperCase() + k.slice(1), value: String(v) }))

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

  return Response.json({ sent, recipients: recipients.length })
}

export const Route = createFileRoute('/api/public/admin-alerts-dispatch')({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      GET: ({ request }) => handle(request),
    },
  },
})
