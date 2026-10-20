import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * L'admin confirme avoir reçu le virement d'un devis : même effet qu'un paiement par carte
 * (devis payé, mission confirmée, facture créée, mail de confirmation + mail facture avec PDF).
 */
export const confirmVirementDevis = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { devisId: string }) => z.object({ devisId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as { supabase: any; userId: string }
    const { data: isAdmin } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' })
    const { data: isSuper } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'super_admin' })
    if (!isAdmin && !isSuper) throw new Error('Accès administrateur requis')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: d } = await supabaseAdmin
      .from('devis')
      .select('id, numero, email, prix_estime, avoir_applique, paid_at, statut')
      .eq('id', data.devisId)
      .maybeSingle()
    if (!d) throw new Error('Devis introuvable')
    const row = d as { id: string; numero: string; email: string | null; prix_estime: number; avoir_applique: number | null; paid_at: string | null; statut: string }
    if (row.paid_at) throw new Error('Ce devis est déjà marqué payé.')
    if (['refuse', 'annule'].includes(row.statut)) throw new Error('Ce devis est refusé ou annulé.')
    if (!row.email) throw new Error('Aucune adresse email pour ce client : la facture ne pourrait pas partir.')

    const net = Math.max(Number(row.prix_estime) - Number(row.avoir_applique ?? 0), 0)
    const { handleDevisWebhookEvent } = await import('@/lib/stripe-webhooks.server')
    await handleDevisWebhookEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `virement-${row.id}`,
          metadata: { devis_id: row.id, mode: 'virement' },
          payment_intent: null,
          amount_total: Math.round(net * 100),
        },
      },
    })
    return { ok: true as const, email: row.email, montant: net }
  })
