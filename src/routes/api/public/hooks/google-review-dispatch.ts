/**
 * Job automatique : demande d'avis Google X heures après la fin d'une mission.
 * Appelé par pg_cron (POST, header apikey).
 */
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hooks/google-review-dispatch')({
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
        const { getGoogleReviewSettings, sendGoogleReviewRequestServer } = await import(
          '@/lib/google-review.server'
        )

        const settings = await getGoogleReviewSettings()
        if (!settings.auto_enabled || !settings.url) {
          return Response.json({ skipped: 'auto_disabled' })
        }

        const cutoff = new Date(Date.now() - settings.delay_hours * 3_600_000).toISOString()

        const { data: attributions } = await supabaseAdmin
          .from('attributions')
          .select('id, trajet_id, statut, updated_at')
          .in('statut', ['termine', 'validee'])
          .lte('updated_at', cutoff)
          .gte('updated_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
          .limit(50)

        let sent = 0
        for (const a of attributions ?? []) {
          const { data: existing } = await supabaseAdmin
            .from('mission_review_requests')
            .select('recipient_type')
            .eq('attribution_id', a.id)
          const done = new Set((existing ?? []).map((r) => r.recipient_type))

          if (!done.has('client')) {
            const res = await sendGoogleReviewRequestServer({
              attributionId: a.id,
              recipientType: 'client',
              auto: true,
            })
            if (res.ok) sent++
          }
          if (settings.send_to_contact && !done.has('contact_livraison')) {
            const res = await sendGoogleReviewRequestServer({
              attributionId: a.id,
              recipientType: 'contact_livraison',
              auto: true,
            })
            if (res.ok) sent++
          }
        }

        return Response.json({ ok: true, processed: attributions?.length ?? 0, sent })
      },
    },
  },
})
