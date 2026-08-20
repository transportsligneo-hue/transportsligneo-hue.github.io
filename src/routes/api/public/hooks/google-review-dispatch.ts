/**
 * Job automatique : demande d'avis Google X heures après la fin d'une mission.
 * Appelé par pg_cron (POST, header apikey).
 */
import { createFileRoute } from '@tanstack/react-router'
import type { ReviewChannel, ReviewRecipientType } from '@/lib/google-review.server'

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

        const channels: ReviewChannel[] =
          settings.channel === 'email+sms' ? ['email', 'sms'] : [settings.channel || 'email']
        const targets: ReviewRecipientType[] = ['client']
        if (settings.send_to_contact) targets.push('contact_livraison')

        let sent = 0
        let skipped = 0
        for (const a of attributions ?? []) {
          const { data: existing } = await supabaseAdmin
            .from('mission_review_requests')
            .select('recipient_type, channel')
            .eq('attribution_id', a.id)
          const done = new Set(
            (existing ?? []).map((r) => `${r.recipient_type}:${r.channel}`),
          )

          for (const recipientType of targets) {
            for (const channel of channels) {
              if (done.has(`${recipientType}:${channel}`)) continue
              const res = await sendGoogleReviewRequestServer({
                attributionId: a.id,
                recipientType,
                channel,
                auto: true,
              })
              if (res.ok) {
                sent++
                done.add(`${recipientType}:${channel}`)
              } else if (res.skipped === 'cooldown') {
                // Client récurrent déjà sollicité récemment : on n'insiste pas.
                skipped++
                done.add(`${recipientType}:${channel}`)
              }
            }
          }
        }

        return Response.json({ ok: true, processed: attributions?.length ?? 0, sent, skipped })
      },
    },
  },
})
