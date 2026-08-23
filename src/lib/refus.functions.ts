import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export type RefusType = 'demande' | 'devis' | 'mission'

export interface RefusInput {
  type: RefusType
  id: string
  motif: string
  notify?: boolean
}

const OBJET_LABEL: Record<RefusType, string> = {
  demande: 'demande de convoyage',
  devis: 'devis',
  mission: 'mission',
}

/** Refus d'une demande, d'un devis ou d'une mission par l'admin, avec motif et email client. */
export const refuseEntity = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RefusInput) => {
    const type = input?.type
    if (type !== 'demande' && type !== 'devis' && type !== 'mission') throw new Error('Type invalide')
    const id = String(input?.id ?? '').trim()
    if (!id) throw new Error('Identifiant manquant')
    const motif = String(input?.motif ?? '').trim()
    if (motif.length < 3) throw new Error('Merci de préciser le motif du refus')
    return { type, id, motif, notify: input?.notify !== false }
  })
  .handler(async ({ data, context }) => {
    const authContext = context as { supabase: any; userId: string }
    const { data: isAdmin } = await authContext.supabase.rpc('has_role', {
      _user_id: authContext.userId,
      _role: 'admin',
    })
    if (!isAdmin) {
      const { data: isSuper } = await authContext.supabase.rpc('has_role', {
        _user_id: authContext.userId,
        _role: 'super_admin',
      })
      if (!isSuper) throw new Error('Forbidden')
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const now = new Date().toISOString()

    let email = ''
    let prenom = ''
    let numero = ''
    let trajetLabel = ''

    if (data.type === 'demande') {
      const { data: row, error } = await supabaseAdmin
        .from('demandes_convoyage')
        .select('id, email, prenom, nom, depart, arrivee')
        .eq('id', data.id)
        .maybeSingle()
      if (error || !row) throw new Error('Demande introuvable')
      email = row.email ?? ''
      prenom = row.prenom ?? ''
      trajetLabel = [row.depart, row.arrivee].filter(Boolean).join(' → ')
      const { error: upErr } = await supabaseAdmin
        .from('demandes_convoyage')
        .update({ statut: 'annulee', refus_motif: data.motif, refused_at: now })
        .eq('id', data.id)
      if (upErr) throw new Error(upErr.message)
    } else if (data.type === 'devis') {
      const { data: row, error } = await supabaseAdmin
        .from('devis')
        .select('id, email, prenom, numero, depart, arrivee')
        .eq('id', data.id)
        .maybeSingle()
      if (error || !row) throw new Error('Devis introuvable')
      email = row.email ?? ''
      prenom = row.prenom ?? ''
      numero = row.numero ?? ''
      trajetLabel = [row.depart, row.arrivee].filter(Boolean).join(' → ')
      const { error: upErr } = await supabaseAdmin
        .from('devis')
        .update({ statut: 'refuse', refus_motif: data.motif, refused_at: now })
        .eq('id', data.id)
      if (upErr) throw new Error(upErr.message)
    } else {
      const { data: row, error } = await supabaseAdmin
        .from('trajets')
        .select('id, client_email, client_nom, depart, arrivee')
        .eq('id', data.id)
        .maybeSingle()
      if (error || !row) throw new Error('Mission introuvable')
      email = row.client_email ?? ''
      prenom = (row.client_nom ?? '').split(' ')[0] ?? ''
      trajetLabel = [row.depart, row.arrivee].filter(Boolean).join(' → ')
      const { error: upErr } = await supabaseAdmin
        .from('trajets')
        .update({ statut: 'annule', refus_motif: data.motif, refused_at: now })
        .eq('id', data.id)
      if (upErr) throw new Error(upErr.message)
    }

    let emailed = false
    if (data.notify && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
      const { sendTransactionalEmailServer } = await import('@/server/email-send')
      const res = await sendTransactionalEmailServer({
        templateName: 'refus-client',
        recipientEmail: email,
        idempotencyKey: `refus-${data.type}-${data.id}-${Date.now()}`,
        templateData: {
          prenom,
          objet: OBJET_LABEL[data.type],
          numero,
          motif: data.motif,
          trajet: trajetLabel,
        },
      })
      emailed = res.success
    }

    return { ok: true as const, emailed, email }
  })
