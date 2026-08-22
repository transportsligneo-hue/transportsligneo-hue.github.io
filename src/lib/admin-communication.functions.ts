import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export const getEmailTemplateCatalog = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })
    const { data: isSuper } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' })
    if (!isAdmin && !isSuper) throw new Error('Forbidden')

    const { TEMPLATES } = await import('@/lib/email-templates/registry')
    return Object.entries(TEMPLATES).map(([name, entry]) => ({
      name,
      displayName: entry.displayName || name,
      subject: typeof entry.subject === 'string' ? entry.subject : 'Sujet dynamique',
      fields: Object.keys(entry.previewData ?? {}),
      previewData: entry.previewData ?? {},
    }))
  })

export const getCommunicationRecipients = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope: 'convoyeurs' | 'clients' }) =>
    z.object({ scope: z.enum(['convoyeurs', 'clients']) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })
    const { data: isSuper } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' })
    if (!isAdmin && !isSuper) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    if (data.scope === 'convoyeurs') {
      const { data: rows, error } = await supabaseAdmin
        .from('convoyeurs')
        .select('id, user_id, prenom, nom, email, ville, statut')
        .not('user_id', 'is', null)
        .order('nom', { ascending: true })
        .limit(500)
      if (error) throw new Error(error.message)
      return (rows ?? []).map((r: any) => ({
        userId: r.user_id as string,
        label: `${r.prenom ?? ''} ${r.nom ?? ''}`.trim() || r.email || 'Convoyeur',
        email: r.email as string | null,
        meta: [r.ville, r.statut].filter(Boolean).join(' · '),
        role: 'convoyeur' as const,
      }))
    }

    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'client')
      .eq('actif', true)
      .limit(500)
    if (roleError) throw new Error(roleError.message)
    const userIds = [...new Set((roleRows ?? []).map((r: any) => r.user_id as string))]
    if (!userIds.length) return []

    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id, prenom, nom, email, societe, type_client')
      .in('user_id', userIds)
      .order('nom', { ascending: true })
      .limit(500)
    if (error) throw new Error(error.message)
    return (profiles ?? []).map((p: any) => ({
      userId: p.user_id as string,
      label: p.societe || `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || p.email || 'Client',
      email: p.email as string | null,
      meta: p.type_client || 'client',
      role: 'client' as const,
    }))
  })

export const sendAdminPushNotification = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    target: { mode: 'user' | 'role' | 'all'; userId?: string; role?: 'convoyeur' | 'client' }
    payload: { title: string; body?: string; url?: string; priority?: 'normal' | 'high' | 'urgent' }
  }) =>
    z.object({
      target: z.discriminatedUnion('mode', [
        z.object({ mode: z.literal('user'), userId: z.string().uuid() }),
        z.object({ mode: z.literal('role'), role: z.enum(['convoyeur', 'client']) }),
        z.object({ mode: z.literal('all') }),
      ]),
      payload: z.object({
        title: z.string().min(2).max(120),
        body: z.string().max(500).optional(),
        url: z.string().max(500).optional(),
        priority: z.enum(['normal', 'high', 'urgent']).optional(),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })
    const { data: isSuper } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' })
    if (!isAdmin && !isSuper) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    let userIds: string[] = []

    if (data.target.mode === 'user') {
      userIds = [data.target.userId]
    } else {
      const roles: Array<'convoyeur' | 'client'> = data.target.mode === 'all' ? ['convoyeur', 'client'] : [data.target.role]
      const { data: rows, error } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .in('role', roles)
        .eq('actif', true)
      if (error) throw new Error(error.message)
      userIds = [...new Set((rows ?? []).map((r: any) => r.user_id as string).filter(Boolean))]
    }

    if (!userIds.length) return { recipients: 0, inserted: 0, sent: 0, removed: 0 }

    const url = data.payload.url && data.payload.url.startsWith('/') ? data.payload.url : '/notifications'
    const rows = userIds.map((userId) => ({
      user_id: userId,
      type: 'message_admin',
      titre: data.payload.title,
      message: data.payload.body ?? null,
      link: url,
      deep_link: url,
      category: 'message',
      priority: data.payload.priority ?? 'normal',
      metadata: { source: 'admin_manual' },
    }))

    const { error: insertError } = await supabaseAdmin.from('user_notifications').insert(rows)
    if (insertError) throw new Error(insertError.message)

    let sent = 0
    let removed = 0
    try {
      const { sendPushToUser } = await import('@/lib/push/send.server')
      for (const userId of userIds) {
        const res = await sendPushToUser(userId, {
          title: data.payload.title,
          body: data.payload.body,
          url,
          tag: `admin-message-${Date.now()}`,
          requireInteraction: data.payload.priority === 'urgent',
        })
        sent += res.sent
        removed += res.removed
      }
    } catch (error) {
      console.warn('[admin-communication] web push failed, in-app notifications kept', error)
    }

    return { recipients: userIds.length, inserted: rows.length, sent, removed }
  })
/* ------------------------------------------------------------------ */
/* Messagerie directe admin -> utilisateur (email + compte / app Driver) */
/* ------------------------------------------------------------------ */

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })
  const { data: isSuper } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' })
  if (!isAdmin && !isSuper) throw new Error('Forbidden')
}

export const getUserMessages = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: rows, error } = await supabaseAdmin
      .from('user_notifications')
      .select('id, titre, message, category, priority, lu, created_at, metadata, link')
      .eq('user_id', data.userId)
      .eq('category', 'message')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(error.message)
    const items = rows ?? []
    return {
      items,
      total: items.length,
      unread: items.filter((r: any) => !r.lu).length,
    }
  })

export const sendAdminDirectMessage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    userId?: string | null
    email?: string | null
    prenom?: string | null
    title: string
    body: string
    channels: { email: boolean; app: boolean }
    role?: 'convoyeur' | 'client' | null
  }) =>
    z.object({
      userId: z.string().uuid().nullable().optional(),
      email: z.string().email().nullable().optional(),
      prenom: z.string().max(120).nullable().optional(),
      title: z.string().min(2).max(120),
      body: z.string().min(1).max(2000),
      channels: z.object({ email: z.boolean(), app: z.boolean() }),
      role: z.enum(['convoyeur', 'client']).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const result = { app: false, push: 0, email: false, emailReason: undefined as string | undefined }

    if (data.channels.app && data.userId) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
      const url = data.role === 'client' ? '/dashboard-client' : '/convoyeur'
      const { error } = await supabaseAdmin.from('user_notifications').insert({
        user_id: data.userId,
        type: 'message_admin',
        titre: data.title,
        message: data.body,
        link: url,
        deep_link: url,
        category: 'message',
        priority: 'high',
        metadata: { source: 'admin_direct_message' },
      })
      if (error) throw new Error(error.message)
      result.app = true
      try {
        const { sendPushToUser } = await import('@/lib/push/send.server')
        const res = await sendPushToUser(data.userId, {
          title: data.title,
          body: data.body.slice(0, 160),
          url,
          tag: `admin-message-${Date.now()}`,
        })
        result.push = res.sent
      } catch (error) {
        console.warn('[admin-direct-message] push failed', error)
      }
    }

    if (data.channels.email && data.email) {
      const { sendTransactionalEmailServer } = await import('@/server/email-send')
      const res = await sendTransactionalEmailServer({
        templateName: 'message-manuel',
        recipientEmail: data.email,
        templateData: {
          prenom: data.prenom ?? undefined,
          titre: data.title,
          message: data.body,
          ctaLabel: 'Accéder à mon espace',
          ctaUrl: 'https://transportsligneo.fr/login',
        },
      })
      result.email = res.success
      result.emailReason = res.reason
    }

    return result
  })
