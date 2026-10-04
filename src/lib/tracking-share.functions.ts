import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

const SITE = 'https://www.transportsligneo.fr'
const CLOSED = ['termine', 'validee', 'livree', 'en_attente_validation', 'annule', 'annulee']

const refSchema = z.object({
  missionId: z.string().uuid().optional(),
  trajetId: z.string().uuid().optional(),
})
const sendSchema = refSchema.extend({
  email: z.string().trim().toLowerCase().email('Adresse email invalide').max(255),
})

type Ctx = { supabase: any; userId: string }

async function isAdmin(ctx: Ctx) {
  for (const role of ['admin', 'super_admin']) {
    const { data } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: role })
    if (data) return true
  }
  return false
}

/** Résout la mission et vérifie l'accès (admin, ou client propriétaire via RLS). */
async function resolveMission(ctx: Ctx, ref: z.infer<typeof refSchema>) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const admin = await isAdmin(ctx)
  let missionId = ref.missionId ?? null
  if (!missionId && ref.trajetId) {
    if (!admin) throw new Error('Accès refusé')
    const { data: t } = await supabaseAdmin.from('trajets').select('mission_id').eq('id', ref.trajetId).maybeSingle()
    missionId = (t as { mission_id?: string } | null)?.mission_id ?? null
  }
  if (!missionId) throw new Error("Cette mission n'est pas encore créée : le suivi sera disponible après validation.")
  if (!admin) {
    const { data: visible } = await ctx.supabase.from('missions').select('id').eq('id', missionId).maybeSingle()
    if (!visible) throw new Error('Accès refusé')
  }
  const { data: m } = await supabaseAdmin
    .from('missions')
    .select('id, numero, statut, tracking_code, tracking_recipient_email, contact_arrivee_nom')
    .eq('id', missionId)
    .maybeSingle()
  if (!m) throw new Error('Mission introuvable')
  let code = m.tracking_code as string | null
  if (!code) {
    const { data: gen } = await supabaseAdmin.rpc('gen_tracking_code' as never)
    code = String(gen ?? '')
    if (code) await supabaseAdmin.from('missions').update({ tracking_code: code }).eq('id', m.id)
  }
  return { supabaseAdmin, admin, mission: { ...m, tracking_code: code } }
}

export const getTrackingShareInfo = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => refSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, mission } = await resolveMission(context as Ctx, data)
    const { data: last } = await supabaseAdmin
      .from('tracking_code_sends')
      .select('created_at, recipient_email, actor_role, status')
      .eq('mission_id', mission.id)
      .order('created_at', { ascending: false })
      .limit(5)
    return {
      missionId: mission.id,
      numero: mission.numero as string,
      code: mission.tracking_code ?? '',
      email: (mission.tracking_recipient_email as string | null) ?? '',
      closed: CLOSED.includes(String(mission.statut ?? '').toLowerCase()),
      history: (last ?? []) as Array<{ created_at: string; recipient_email: string; actor_role: string; status: string }>,
    }
  })

export const sendTrackingCode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { supabaseAdmin, admin, mission } = await resolveMission(ctx, data)
    if (CLOSED.includes(String(mission.statut ?? '').toLowerCase())) {
      throw new Error('Mission terminée ou annulée : le suivi GPS n\'est plus disponible.')
    }
    if (!mission.tracking_code) throw new Error('Code de suivi indisponible')

    // Anti double-envoi : même destinataire dans les 60 dernières secondes
    const since = new Date(Date.now() - 60_000).toISOString()
    const { data: recent } = await supabaseAdmin
      .from('tracking_code_sends')
      .select('id')
      .eq('mission_id', mission.id)
      .eq('recipient_email', data.email)
      .eq('status', 'sent')
      .gte('created_at', since)
      .limit(1)
    if (recent && recent.length) throw new Error('Email déjà envoyé il y a moins d\'une minute.')

    const { sendTransactionalEmailServer } = await import('@/server/email-send')
    const res = await sendTransactionalEmailServer({
      templateName: 'suivi-gps-destinataire',
      recipientEmail: data.email,
      idempotencyKey: `suivi-gps-${mission.id}-${data.email}-${Math.floor(Date.now() / 60_000)}`,
      templateData: {
        numero: mission.numero,
        code: mission.tracking_code,
        destinataire: mission.contact_arrivee_nom ?? '',
        suiviUrl: `${SITE}/suivi?numero=${encodeURIComponent(mission.numero)}`,
      },
    })

    await supabaseAdmin.from('tracking_code_sends').insert({
      mission_id: mission.id,
      sent_by: ctx.userId,
      actor_role: admin ? 'admin' : 'client',
      recipient_email: data.email,
      status: res.success ? 'sent' : res.reason ?? 'failed',
      error_message: res.success ? null : res.reason ?? null,
    })
    await supabaseAdmin.from('missions').update({ tracking_recipient_email: data.email }).eq('id', mission.id)

    if (!res.success) {
      throw new Error(res.reason === 'email_suppressed'
        ? 'Ce destinataire s\'est désinscrit des emails Transports Ligneo.'
        : 'Envoi impossible pour le moment, réessayez.')
    }
    return { ok: true as const, sentAt: new Date().toISOString() }
  })
