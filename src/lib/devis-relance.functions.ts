import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/** Relance d'un devis par email (signature ou paiement), lien personnel sans connexion. */
export const relanceDevis = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { devisId: string; message?: string }) =>
    z.object({ devisId: z.string().uuid(), message: z.string().max(600).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as { supabase: any; userId: string }
    const { data: isAdmin } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' })
    const { data: isSuper } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'super_admin' })
    if (!isAdmin && !isSuper) throw new Error('Accès administrateur requis')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: d, error } = await supabaseAdmin
      .from('devis')
      .select('id, numero, prenom, email, depart, arrivee, prix_estime, avoir_applique, date_souhaitee, locked_at, paid_at, statut, paiement_immediat, public_token')
      .eq('id', data.devisId)
      .maybeSingle()
    if (error || !d) throw new Error('Devis introuvable')
    const row = d as {
      numero: string; prenom: string | null; email: string | null; depart: string; arrivee: string
      prix_estime: number; avoir_applique: number | null; date_souhaitee: string | null
      locked_at: string | null; paid_at: string | null; statut: string
      paiement_immediat: boolean | null; public_token: string | null
    }

    if (row.paid_at) throw new Error('Ce devis est déjà payé : rien à relancer.')
    if (['refuse', 'annule', 'expire', 'convertit'].includes(row.statut)) throw new Error('Ce devis n’est plus actif : relance impossible.')
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(row.email)) throw new Error('Aucune adresse email valide pour ce client.')
    if (!row.public_token) throw new Error('Ce devis n’a pas de lien public : ouvrez-le puis renvoyez-le au client depuis « Modifier ».')

    const signe = !!row.locked_at
    if (signe && row.paiement_immediat === false) throw new Error('Devis signé, règlement sur facture : rien à relancer.')
    const etape: 'signer' | 'payer' = signe ? 'payer' : 'signer'

    const { devisPublicUrl } = await import('@/lib/devis-public.server')
    const lien = devisPublicUrl(row.public_token)
    const net = Math.max(Number(row.prix_estime) - Number(row.avoir_applique ?? 0), 0)
    let dateTxt = ''
    if (row.date_souhaitee) {
      const dt = new Date(row.date_souhaitee)
      dateTxt = Number.isNaN(dt.getTime()) ? String(row.date_souhaitee) : dt.toLocaleDateString('fr-FR')
    }

    const { sendTransactionalEmailServer } = await import('@/server/email-send')
    const res = await sendTransactionalEmailServer({
      templateName: 'devis-relance',
      recipientEmail: row.email,
      idempotencyKey: `relance-${data.devisId}-${Date.now()}`,
      templateData: {
        prenom: row.prenom ?? '',
        numero: row.numero,
        depart: row.depart,
        arrivee: row.arrivee,
        prix: net.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        dateSouhaitee: dateTxt,
        lien,
        etape,
        message: data.message ?? '',
      },
    })
    if (!res.success) throw new Error('Envoi impossible (' + (res.reason ?? 'erreur') + ')')
    return { ok: true as const, etape, email: row.email, lien }
  })
