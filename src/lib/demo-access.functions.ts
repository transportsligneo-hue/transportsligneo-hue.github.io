import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const ADMIN_EMAIL = 'contact@transportsligneo.fr'
const DAYS = 7

function safeOrigin(o: string) {
  return /^https:\/\/([a-z0-9-]+\.)*(lovable\.app|transportsligneo\.fr)$/.test(o) || o.startsWith('http://localhost')
    ? o
    : 'https://transportsligneo.fr'
}

function newToken() {
  const b = new Uint8Array(24)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

/** Formulaire public « Demander une démo ». */
export const requestDemo = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z.object({
      nom: z.string().trim().min(2).max(120),
      societe: z.string().trim().min(1).max(160),
      email: z.string().trim().email().max(255),
      telephone: z.string().trim().max(30).optional().default(''),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const email = data.email.toLowerCase()
    // Anti-abus : une demande par e-mail toutes les 10 minutes, 30 par heure au total.
    const since10 = new Date(Date.now() - 10 * 60000).toISOString()
    const since60 = new Date(Date.now() - 60 * 60000).toISOString()
    const [{ count: mine }, { count: all }] = await Promise.all([
      supabaseAdmin.from('pro_demo_access').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since10),
      supabaseAdmin.from('pro_demo_access').select('id', { count: 'exact', head: true }).gte('created_at', since60),
    ])
    if ((mine ?? 0) > 0) return { ok: true }
    if ((all ?? 0) > 30) throw new Error('Trop de demandes pour le moment, réessayez plus tard.')

    const { data: row, error } = await supabaseAdmin
      .from('pro_demo_access')
      .insert({ email, nom_contact: data.nom, societe: data.societe, telephone: data.telephone || null })
      .select('id')
      .single()
    if (error || !row) throw new Error("La demande n'a pas pu être enregistrée.")

    try {
      await supabaseAdmin.rpc('create_admin_notification', {
        _type: 'demo_request',
        _titre: 'Nouvelle demande de démo',
        _message: `${data.nom} — ${data.societe} (${email}${data.telephone ? ' · ' + data.telephone : ''})`,
        _link: '/admin/acces-demo',
        _entity_type: 'pro_demo_access',
        _entity_id: row.id,
        _metadata: {},
      })
    } catch (e) {
      console.error('demo admin bell failed', e)
    }

    try {
      const { sendTransactionalEmailServer } = await import('@/server/email-send')
      await sendTransactionalEmailServer({
        templateName: 'demo-demande-admin',
        recipientEmail: ADMIN_EMAIL,
        idempotencyKey: `demo-req-${row.id}`,
        templateData: { nom: data.nom, societe: data.societe, email, telephone: data.telephone },
      })
    } catch (e) {
      console.error('demo admin notify failed', e)
    }
    return { ok: true }
  })

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const [a, s] = await Promise.all([
    ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' }),
    ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'super_admin' }),
  ])
  if (!a.data && !s.data) throw new Error('Accès refusé')
}

/** Admin : envoie (ou renvoie) le lien démo à une demande existante ou à une nouvelle adresse. */
export const sendDemoAccess = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      email: z.string().trim().email().max(255).optional(),
      societe: z.string().trim().max(160).optional(),
      nom: z.string().trim().max(120).optional(),
      origin: z.string().url().max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const token = newToken()
    const expires_at = new Date(Date.now() + DAYS * 86400000).toISOString()
    const patch = { token, expires_at, statut: 'lien_envoye', sent_at: new Date().toISOString() }
    let row: { id: string; email: string; societe: string | null; nom_contact: string | null } | null = null
    if (data.id) {
      const r = await context.supabase.from('pro_demo_access').update(patch).eq('id', data.id).select('id,email,societe,nom_contact').single()
      row = r.data
    } else if (data.email) {
      const r = await context.supabase.from('pro_demo_access').insert({ ...patch, email: data.email.toLowerCase(), societe: data.societe || null, nom_contact: data.nom || null }).select('id,email,societe,nom_contact').single()
      row = r.data
    }
    if (!row) throw new Error("Impossible de préparer l'accès démo.")

    const { sendTransactionalEmailServer } = await import('@/server/email-send')
    await sendTransactionalEmailServer({
      templateName: 'demo-acces',
      recipientEmail: row.email,
      idempotencyKey: `demo-access-${token}`,
      templateData: { nom: row.nom_contact, societe: row.societe, lien: `${safeOrigin(data.origin)}/demo-pro?token=${token}` },
    })
    return { ok: true }
  })

/** Public : vérifie un lien démo et enregistre l'ouverture. */
export const verifyDemoToken = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: row } = await supabaseAdmin.from('pro_demo_access').select('id, societe, expires_at, opened_at, open_count').eq('token', data.token).maybeSingle()
    if (!row || !row.expires_at || new Date(row.expires_at).getTime() < Date.now()) return { ok: false as const }
    await supabaseAdmin.from('pro_demo_access').update({
      statut: 'consulte',
      opened_at: row.opened_at ?? new Date().toISOString(),
      open_count: (row.open_count ?? 0) + 1,
    }).eq('id', row.id)
    return { ok: true as const, societe: row.societe }
  })
