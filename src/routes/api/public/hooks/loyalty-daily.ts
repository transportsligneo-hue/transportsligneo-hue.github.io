/**
 * Job quotidien du Compte Kilomètres Ligneo (appelé par pg_cron, header apikey) :
 *  1. clôture des périodes de 12 mois échues (calcul du taux + crédit de l'avoir)
 *  2. expiration des avoirs de plus de 24 mois
 *  3. notifications : palier atteint, avoir crédité, rappel J-30 avant expiration
 */
import { createFileRoute } from '@tanstack/react-router'
import { currentTier, type LoyaltyTier } from '@/lib/loyalty'

export const Route = createFileRoute('/api/public/hooks/loyalty-daily')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get('apikey') ?? ''
        const expected =
          process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'] ?? ''
        if (!expected || key !== expected) {
          return new Response('Unauthorized', { status: 401 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { notifyTierReached, notifyRewardCredited, notifyExpiryReminder } = await import(
          '@/lib/loyalty.server'
        )

        // 1 & 2 — traitement en base (SECURITY DEFINER, réservé au service role)
        await supabaseAdmin.rpc('loyalty_close_due_periods' as never)
        await supabaseAdmin.rpc('loyalty_expire_avoirs' as never)

        const { data: tiersRows } = await supabaseAdmin
          .from('loyalty_settings')
          .select('*')
          .order('sort_order')
        const tiers = (tiersRows ?? []) as unknown as LoyaltyTier[]

        // 3a — avoirs crédités non encore notifiés
        const { data: newRewards } = await supabaseAdmin
          .from('loyalty_rewards_history')
          .select('id')
          .is('notified_at', null)
          .gt('montant_avoir_genere', 0)
          .limit(100)
        let credited = 0
        for (const r of newRewards ?? []) {
          try {
            await notifyRewardCredited(r.id)
            credited++
          } catch (e) {
            console.warn('[loyalty-daily] reward notify failed', e)
          }
        }

        // 3b — passage de palier depuis la dernière notification
        const { data: accounts } = await supabaseAdmin
          .from('loyalty_accounts')
          .select('id, client_id, email, km_cumules_periode, taux_notifie')
          .gt('km_cumules_periode', 0)
          .limit(500)
        let tierNotified = 0
        for (const a of accounts ?? []) {
          const tier = currentTier(Number(a.km_cumules_periode), tiers)
          if (Number(a.taux_notifie ?? 0) >= tier.taux) continue
          try {
            await notifyTierReached({
              clientId: a.client_id,
              email: a.email,
              km: Number(a.km_cumules_periode),
              tiers,
            })
            await supabaseAdmin
              .from('loyalty_accounts')
              .update({ taux_notifie: tier.taux })
              .eq('id', a.id)
            tierNotified++
          } catch (e) {
            console.warn('[loyalty-daily] tier notify failed', e)
          }
        }

        // 3c — rappel 30 jours avant expiration
        const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
        const in31 = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10)
        const { data: expiring } = await supabaseAdmin
          .from('loyalty_rewards_history')
          .select('id')
          .in('statut', ['actif', 'partiel'])
          .is('expiry_reminder_sent_at', null)
          .gte('date_expiration_avoir', in30)
          .lt('date_expiration_avoir', in31)
          .limit(200)
        let reminders = 0
        for (const r of expiring ?? []) {
          try {
            await notifyExpiryReminder(r.id)
            reminders++
          } catch (e) {
            console.warn('[loyalty-daily] expiry notify failed', e)
          }
        }

        return Response.json({ ok: true, credited, tierNotified, reminders })
      },
    },
  },
})
