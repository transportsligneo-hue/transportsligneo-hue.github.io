import { createFileRoute } from '@tanstack/react-router'
import { LIGNEO_SITE_ORIGIN } from '@/lib/brand-assets'

export const Route = createFileRoute('/api/public/track-click')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams
        const rid = params.get('rid')
        const target = params.get('url')

        let destination = LIGNEO_SITE_ORIGIN
        if (target) {
          try {
            const parsed = new URL(target)
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
              destination = parsed.toString()
            }
          } catch {
            // URL invalide : repli sur le site.
          }
        }

        if (rid) {
          try {
            const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
            const { data: recipient } = await supabaseAdmin
              .from('campaign_recipients')
              .select('id, campaign_id')
              .eq('id', rid)
              .maybeSingle()
            if (recipient) {
              await supabaseAdmin.from('campaign_events').insert({
                campaign_id: recipient.campaign_id,
                recipient_id: recipient.id,
                event_type: 'click',
                link_url: destination,
                user_agent: request.headers.get('user-agent'),
              })
            }
          } catch (error) {
            console.error('[track-click] failed', error)
          }
        }

        return new Response(null, {
          status: 302,
          headers: { Location: destination, 'Cache-Control': 'no-store' },
        })
      },
    },
  },
})
