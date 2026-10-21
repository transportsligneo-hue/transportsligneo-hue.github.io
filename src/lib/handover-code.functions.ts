import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Codes de remise (type Uber).
 *  - depart  : la personne qui remet les clés reçoit un code par SMS / e-mail, le donne au
 *              convoyeur qui le saisit. Un e-mail de confirmation part aussitôt au client.
 *  - arrivee : le destinataire reçoit un code par SMS, le donne au convoyeur qui le saisit.
 */
const Input = z.object({ attributionId: z.string().uuid(), kind: z.enum(['depart', 'arrivee']) })

function newCode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

async function loadContext(supabase: any, userId: string, attributionId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: attr } = await supabaseAdmin
    .from('attributions')
    .select('id, convoyeur_id, numero_mission, trajet_id')
    .eq('id', attributionId)
    .maybeSingle()
  if (!attr) throw new Error('Mission introuvable.')
  let allowed = (attr as any).convoyeur_id === userId
  if (!allowed) {
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('actif', true)
    allowed = (roles ?? []).some((r: any) => r.role === 'admin' || r.role === 'super_admin')
  }
  if (!allowed) {
    // convoyeur_id peut référencer la table convoyeurs : on tente via user_id
    const { data: cv } = await supabaseAdmin.from('convoyeurs').select('user_id').eq('id', (attr as any).convoyeur_id).maybeSingle()
    allowed = (cv as any)?.user_id === userId
  }
  if (!allowed) throw new Error('Accès refusé.')
  const { data: trajet } = await supabaseAdmin
    .from('trajets')
    .select('contact_depart_tel, contact_arrivee_tel, arrivee_contact_telephone, client_telephone, client_email, arrivee_contact_email')
    .eq('id', (attr as any).trajet_id)
    .maybeSingle()
  return { supabaseAdmin, attr: attr as any, trajet: (trajet ?? {}) as any }
}

export const prepareHandoverCode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, attr, trajet } = await loadContext(context.supabase, context.userId, data.attributionId)
    const { data: existing } = await supabaseAdmin
      .from('handover_codes').select('*').eq('attribution_id', data.attributionId).eq('kind', data.kind).maybeSingle()
    if (existing && ((existing as any).validated_at || (existing as any).skipped)) {
      return { done: true as const }
    }
    let row: any = existing
    if (!row) {
      const { data: ins, error } = await supabaseAdmin
        .from('handover_codes')
        .insert({ attribution_id: data.attributionId, kind: data.kind, code: newCode() } as never)
        .select('*').single()
      if (error) throw new Error(error.message)
      row = ins
    }
    const candidates: Array<string | null> =
      data.kind === 'depart'
        ? [trajet.contact_depart_tel, trajet.client_telephone]
        : [trajet.arrivee_contact_telephone, trajet.contact_arrivee_tel, trajet.client_telephone]
    // SMS uniquement vers un mobile (06/07, +336/+337) : les fixes ne reçoivent pas de SMS
    const isMobile = (t?: string | null) => {
      if (!t) return false
      const d = t.replace(/\D/g, '')
      return /^(33|0033)?0?[67]\d{8}$/.test(d)
    }
    const mobile = candidates.find(isMobile) ?? null
    const email: string | null =
      (data.kind === 'depart' ? trajet.client_email : trajet.arrivee_contact_email || trajet.client_email) || null

    const num = attr.numero_mission ? ` (mission ${attr.numero_mission})` : ''
    const message =
      data.kind === 'depart'
        ? `Transports Ligneo${num} : votre code d'enlèvement est ${row.code}. Donnez-le au convoyeur au moment de lui remettre les clés, et uniquement à lui.`
        : `Transports Ligneo${num} : votre code de livraison est ${row.code}. Donnez-le au convoyeur à la remise du véhicule uniquement.`

    let smsOk = !!row.sms_sent_at
    let via: 'sms' | 'email' | null = smsOk ? 'sms' : null
    if (!smsOk && mobile) {
      const { sendSms } = await import('@/lib/sms.server')
      const r = await sendSms({ to: mobile, body: message })
      if (r.ok) { smsOk = true; via = 'sms' }
    }
    if (!smsOk && email) {
      try {
        const { sendBrevoEmail } = await import('@/lib/brevo-email.server')
        await sendBrevoEmail({
          to: email,
          fromName: 'Transports Ligneo',
          subject: data.kind === 'depart' ? 'Votre code d\'enlèvement' : 'Votre code de livraison',
          html: `<p style="font-family:Arial,sans-serif;font-size:16px">${message.replace(row.code, `<b style="font-size:24px">${row.code}</b>`)}</p>`,
          text: message,
        })
        smsOk = true; via = 'email'
      } catch { /* on retombe sur "aucun moyen d'envoi" */ }
    }
    if (smsOk && !row.sms_sent_at) {
      await supabaseAdmin.from('handover_codes')
        .update({ sms_to: via === 'email' ? email : mobile, sms_sent_at: new Date().toISOString() } as never).eq('id', row.id)
    }
    const phone = smsOk ? (via ?? 'sms') : null

    // Le code n'est JAMAIS renvoyé au convoyeur : il le reçoit du client
    return { done: false as const, smsSent: smsOk, sentVia: phone as 'sms' | 'email' | null, hasPhone: !!phone }
  })

export const validateHandoverCode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.extend({ code: z.string().trim().min(4).max(4) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, attr, trajet } = await loadContext(context.supabase, context.userId, data.attributionId)
    const { data: row } = await supabaseAdmin
      .from('handover_codes').select('*').eq('attribution_id', data.attributionId).eq('kind', data.kind).maybeSingle()
    if (!row) throw new Error('Code introuvable.')
    const r = row as any
    if (r.validated_at) return { ok: true }
    if (r.attempts >= 5) return { ok: false, locked: true }
    if (r.code !== data.code) {
      await supabaseAdmin.from('handover_codes').update({ attempts: r.attempts + 1 } as never).eq('id', r.id)
      return { ok: false, locked: r.attempts + 1 >= 5 }
    }
    await supabaseAdmin.from('handover_codes').update({ validated_at: new Date().toISOString() } as never).eq('id', r.id)
    // E-mail de confirmation instantané au client (n'empêche jamais la validation)
    try {
      const email: string | null =
        (data.kind === 'depart' ? trajet.client_email : trajet.arrivee_contact_email || trajet.client_email) || null
      if (email) {
        const { sendBrevoEmail } = await import('@/lib/brevo-email.server')
        const num = attr.numero_mission ? ` (mission ${attr.numero_mission})` : ''
        const heure = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })
        const texte = data.kind === 'depart'
          ? `Votre convoyeur Transports Ligneo vient de saisir votre code d'enlèvement${num} le ${heure}. Il prend en charge votre véhicule : un état des lieux photo va être réalisé.`
          : `Votre code de livraison${num} vient d'être validé le ${heure}. Votre véhicule vous a bien été remis.`
        await sendBrevoEmail({
          to: email,
          fromName: 'Transports Ligneo',
          subject: data.kind === 'depart' ? 'Votre véhicule est pris en charge' : 'Votre véhicule a été livré',
          html: `<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5">${texte}</p><p style="font-family:Arial,sans-serif;font-size:13px;color:#667">Ce n'était pas vous ? Contactez-nous au 07 82 45 61 81.</p>`,
          text: texte,
        })
      }
    } catch { /* best effort */ }
    return { ok: true }
  })

/** Départ : le convoyeur confirme avoir donné le code. */
export const confirmHandoverGiven = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await loadContext(context.supabase, context.userId, data.attributionId)
    await supabaseAdmin.from('handover_codes')
      .update({ validated_at: new Date().toISOString() } as never)
      .eq('attribution_id', data.attributionId).eq('kind', data.kind)
    return { ok: true }
  })

/** Sans code possible (pas de téléphone, personne injoignable…) : on passe, l'admin est alerté. */
export const skipHandoverCode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.extend({ reason: z.string().trim().max(300).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, attr } = await loadContext(context.supabase, context.userId, data.attributionId)
    await supabaseAdmin.from('handover_codes')
      .update({ skipped: true, skip_reason: data.reason || null } as never)
      .eq('attribution_id', data.attributionId).eq('kind', data.kind)
    try {
      const { data: admins } = await supabaseAdmin.from('user_roles').select('user_id').in('role', ['admin', 'super_admin']).eq('actif', true)
      for (const a of admins ?? []) {
        await supabaseAdmin.from('admin_notifications').insert({
          user_id: (a as any).user_id,
          type: 'incident',
          titre: `Mission ${attr.numero_mission ?? ''} : remise SANS code (${data.kind === 'depart' ? 'enlèvement' : 'livraison'})`,
          message: data.reason || 'Le convoyeur a continué sans code.',
          link: `/admin/missions/${data.attributionId}`,
        } as never)
      }
    } catch { /* best-effort */ }
    return { ok: true }
  })

export const getHandoverStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ attributionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await loadContext(context.supabase, context.userId, data.attributionId)
    const { data: rows } = await supabaseAdmin
      .from('handover_codes')
      .select('kind, validated_at, skipped, skip_reason, sms_sent_at, shown_at')
      .eq('attribution_id', data.attributionId)
    return { rows: (rows ?? []) as any[] }
  })
