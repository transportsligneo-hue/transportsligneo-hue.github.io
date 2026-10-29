import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })
  const { data: isSuper } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' })
  if (!isAdmin && !isSuper) throw new Error('Forbidden')
}

export type BulkAudienceRow = {
  key: string
  userId: string | null
  email: string
  prenom: string
  nom: string
  ville: string | null
  tags: string[]
  lastSignIn: string | null
}

/** Audience complète (convoyeurs / clients / liste d'attente) avec tags pour filtrer côté écran. */
export const getBulkAudience = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope: 'convoyeurs' | 'clients' | 'waitlist' }) =>
    z.object({ scope: z.enum(['convoyeurs', 'clients', 'waitlist']) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<BulkAudienceRow[]> => {
    await assertAdmin(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const sb = supabaseAdmin as any

    if (data.scope === 'waitlist') {
      const { data: rows, error } = await sb
        .from('convoyeur_waitlist')
        .select('id, email, nom, ville, statut')
        .neq('statut', 'refuse')
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) throw new Error(error.message)
      return (rows ?? []).map((r: any) => ({
        key: `w:${r.id}`,
        userId: null,
        email: r.email,
        prenom: String(r.nom ?? '').split(' ')[0] ?? '',
        nom: r.nom ?? '',
        ville: r.ville ?? null,
        tags: [`statut:${r.statut}`],
        lastSignIn: null,
      }))
    }

    // Dernières connexions (auth) pour le filtre « dernière connexion ».
    const lastSign = new Map<string, string | null>()
    try {
      const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
      for (const u of list?.users ?? []) lastSign.set(u.id, u.last_sign_in_at ?? null)
    } catch { /* optionnel */ }

    if (data.scope === 'convoyeurs') {
      const { data: rows, error } = await sb
        .from('convoyeurs')
        .select('id, user_id, prenom, nom, email, ville, statut, type_convoyeur, created_at')
        .not('email', 'is', null)
        .order('nom', { ascending: true })
        .limit(2000)
      if (error) throw new Error(error.message)
      const { data: docs } = await sb.from('documents_convoyeurs').select('convoyeur_id, statut_validation')
      const withDocs = new Set((docs ?? []).map((d: any) => d.convoyeur_id))
      const recent = Date.now() - 30 * 86400000
      return (rows ?? []).map((r: any) => {
        const tags: string[] = [`statut:${r.statut}`, `type:${r.type_convoyeur}`]
        if (!withDocs.has(r.id)) tags.push('docs:manquants')
        if (r.created_at && new Date(r.created_at).getTime() > recent) tags.push('recent')
        return {
          key: `c:${r.id}`,
          userId: r.user_id ?? null,
          email: r.email,
          prenom: r.prenom ?? '',
          nom: r.nom ?? '',
          ville: r.ville ?? null,
          tags,
          lastSignIn: r.user_id ? lastSign.get(r.user_id) ?? null : null,
        }
      })
    }

    const { data: roleRows, error: roleError } = await sb.from('user_roles').select('user_id').eq('role', 'client').eq('actif', true).limit(2000)
    if (roleError) throw new Error(roleError.message)
    const ids = [...new Set((roleRows ?? []).map((r: any) => r.user_id as string))]
    if (!ids.length) return []
    const { data: profiles, error } = await sb
      .from('profiles')
      .select('user_id, prenom, nom, email, societe, type_client, created_at')
      .in('user_id', ids)
      .limit(2000)
    if (error) throw new Error(error.message)
    return (profiles ?? [])
      .filter((p: any) => p.email)
      .map((p: any) => ({
        key: `u:${p.user_id}`,
        userId: p.user_id,
        email: p.email,
        prenom: p.prenom ?? '',
        nom: p.societe || p.nom || '',
        ville: null,
        tags: [p.type_client === 'flotte' ? 'type:flotte' : p.societe || p.type_client === 'b2b' ? 'type:pro' : 'type:particulier'],
        lastSignIn: lastSign.get(p.user_id) ?? null,
      }))
  })

const recipientSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  email: z.string().email(),
  prenom: z.string().max(120).optional(),
})

/** Envoi groupé : un email individuel (modèle Ligneo « message-manuel ») + notification in-app/push par destinataire. */
export const sendBulkMessage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        recipients: z.array(recipientSchema).min(1).max(1500),
        role: z.enum(['convoyeur', 'client']).nullable().optional(),
        channels: z.object({ email: z.boolean(), app: z.boolean() }),
        subject: z.string().min(2).max(200),
        title: z.string().min(2).max(160),
        body: z.string().min(1).max(4000),
        ctaLabel: z.string().max(60).optional(),
        ctaUrl: z.string().url().max(500).optional(),
        visualUrl: z.string().url().max(800).optional(),
        pushText: z.string().max(200).optional(),
        testOnly: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { sendTransactionalEmailServer, getAdminNotificationEmail } = await import('@/server/email-send')
    const batchId = Date.now()
    const personalize = (txt: string, prenom?: string) => txt.replace(/\{prenom\}/gi, prenom?.trim() || '').replace(/ ,/g, ',')

    let recipients = data.recipients
    if (data.testOnly) {
      const adminEmail = await getAdminNotificationEmail()
      recipients = [{ email: adminEmail, prenom: 'Équipe', userId: null }]
    }

    const result = { recipients: recipients.length, emails: 0, emailsFailed: 0, notifications: 0, push: 0 }

    // Notifications in-app (un seul insert) + push
    if (data.channels.app && !data.testOnly) {
      const url = data.role === 'client' ? '/dashboard-client' : '/convoyeur'
      const withUser = recipients.filter((r) => r.userId)
      if (withUser.length) {
        const rows = withUser.map((r) => ({
          user_id: r.userId as string,
          type: 'message_admin',
          titre: data.title,
          message: data.pushText || personalize(data.body, r.prenom).slice(0, 200),
          link: url,
          deep_link: url,
          category: 'message',
          priority: 'normal',
          metadata: { source: 'admin_bulk', batch: batchId },
        }))
        const { error } = await (supabaseAdmin as any).from('user_notifications').insert(rows)
        if (error) throw new Error(error.message)
        result.notifications = rows.length
        try {
          const { sendPushToUser } = await import('@/lib/push/send.server')
          for (const r of withUser) {
            const res = await sendPushToUser(r.userId as string, {
              title: data.title,
              body: data.pushText || personalize(data.body, r.prenom).slice(0, 160),
              url,
              tag: `admin-bulk-${batchId}`,
            })
            result.push += res.sent
          }
        } catch (e) {
          console.warn('[admin-bulk] push failed, notifications kept', e)
        }
      }
    }

    // Emails individuels, 5 en parallèle
    if (data.channels.email || data.testOnly) {
      const queue = [...recipients]
      const worker = async () => {
        for (let r = queue.shift(); r; r = queue.shift()) {
          try {
            const res = await sendTransactionalEmailServer({
              templateName: 'message-manuel',
              recipientEmail: r.email,
              idempotencyKey: `admin-bulk-${batchId}-${r.email}`,
              templateData: {
                prenom: r.prenom || undefined,
                subject: personalize(data.subject, r.prenom),
                titre: personalize(data.title, r.prenom),
                message: personalize(data.body, r.prenom),
                ctaLabel: data.ctaLabel || undefined,
                ctaUrl: data.ctaUrl || undefined,
                visualUrl: data.visualUrl || undefined,
              },
            } as any)
            if (res.success) result.emails++
            else result.emailsFailed++
          } catch {
            result.emailsFailed++
          }
        }
      }
      await Promise.all([worker(), worker(), worker(), worker(), worker()])
    }
    return result
  })

/** Invitation en lot depuis la liste d'attente : crée le lien personnel, envoie l'email, passe le statut à « invité ». */
export const inviteWaitlistBatch = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[]; origin: string }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200), origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { sendTransactionalEmailServer } = await import('@/server/email-send')
    const sb = supabaseAdmin as any
    const { data: rows, error } = await sb.from('convoyeur_waitlist').select('*').in('id', data.ids)
    if (error) throw new Error(error.message)
    let sent = 0
    const failed: string[] = []
    for (const w of rows ?? []) {
      try {
        // Le RPC vérifie auth.uid() : on l'appelle avec le client de l'admin connecté.
        const [prenom, ...rest] = String(w.nom ?? '').trim().split(' ')
        const { data: inv, error: invErr } = await (context.supabase as any).rpc('admin_create_convoyeur_invitation', {
          _email: w.email,
          _nom: rest.join(' ') || null,
          _prenom: prenom || null,
          _telephone: w.telephone || null,
        })
        if (invErr) throw invErr
        const row = Array.isArray(inv) ? inv[0] : inv
        if (!row?.token) throw new Error('no token')
        const res = await sendTransactionalEmailServer({
          templateName: 'invitation-convoyeur',
          recipientEmail: w.email,
          idempotencyKey: `invitation-convoyeur-${row.token}`,
          templateData: {
            prenom: prenom || null,
            nom: rest.join(' ') || null,
            inviteUrl: `${data.origin}/invitation-convoyeur/${row.token}`,
            expiresLabel: row.expires_at ? new Date(row.expires_at).toLocaleDateString('fr-FR') : null,
          },
        } as any)
        if (!res.success) throw new Error(res.reason || 'email')
        await sb.from('convoyeur_waitlist').update({ statut: 'invite', invited_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', w.id)
        sent++
      } catch (e) {
        console.error('[waitlist] invite failed', w.email, e)
        const why = e instanceof Error ? e.message : String((e as { message?: string } | null)?.message ?? e)
        failed.push(`${w.email} (${why.slice(0, 140)})`)
      }
    }
    return { sent, failed }
  })
