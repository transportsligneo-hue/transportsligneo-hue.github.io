import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const SETTING_KEY = 'admin_alert_emails'

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })
  const { data: isSuper } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' })
  if (!isAdmin && !isSuper) throw new Error('Forbidden')
}

/** Lit les destinataires des alertes plateforme + les dernières alertes en attente. */
export const getAdminAlertSettings = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: row } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle()

    const value = ((row as { value?: unknown } | null)?.value ?? {}) as {
      enabled?: boolean
      emails?: string[]
    }

    const { count: pending } = await supabaseAdmin
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .is('email_sent_at', null)

    const { data: recent } = await supabaseAdmin
      .from('admin_notifications')
      .select('id, type, titre, message, created_at, email_sent_at')
      .order('created_at', { ascending: false })
      .limit(10)

    return {
      enabled: value.enabled !== false,
      emails: Array.isArray(value.emails) ? value.emails : [],
      pending: pending ?? 0,
      recent: (recent ?? []) as Array<{
        id: string
        type: string
        titre: string
        message: string | null
        created_at: string
        email_sent_at: string | null
      }>,
    }
  })

/** Met à jour la liste des adresses qui reçoivent les alertes plateforme. */
export const saveAdminAlertSettings = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled: boolean; emails: string[] }) =>
    z
      .object({ enabled: z.boolean(), emails: z.array(z.string().email()).max(10) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin
      .from('app_settings')
      .upsert(
        { key: SETTING_KEY, value: { enabled: data.enabled, emails: data.emails }, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/** Envoi immédiat des alertes en attente (bouton « Envoyer maintenant »). */
export const runAdminAlertDispatch = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { sendTransactionalEmailServer } = await import('@/server/email-send')

    const { data: row } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle()
    const value = ((row as { value?: unknown } | null)?.value ?? {}) as { enabled?: boolean; emails?: string[] }
    const recipients = (value.emails ?? []).filter((e) => typeof e === 'string' && e.includes('@'))
    if (value.enabled === false || !recipients.length) return { sent: 0 }

    const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
    const { data: pending } = await supabaseAdmin
      .from('admin_notifications')
      .select('id, type, titre, message, link, metadata, created_at')
      .is('email_sent_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(25)

    let sent = 0
    for (const notif of (pending ?? []) as Array<Record<string, any>>) {
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
            categorie: 'Activité plateforme',
            lien: `https://transportsligneo.fr${notif.link ?? '/admin'}`,
            recu_le: new Date(notif.created_at as string).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
            details,
          },
        })
      }
      await supabaseAdmin
        .from('admin_notifications')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', notif.id)
      sent += 1
    }
    return { sent }
  })
