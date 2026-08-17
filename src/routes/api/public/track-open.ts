import { createFileRoute } from '@tanstack/react-router'

// Pixel PNG transparent 1x1
const PIXEL_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function pixelResponse() {
  const bytes = Uint8Array.from(atob(PIXEL_BASE64), (c) => c.charCodeAt(0))
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    },
  })
}

export const Route = createFileRoute('/api/public/track-open')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const rid = new URL(request.url).searchParams.get('rid')
        if (!rid) return pixelResponse()
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
          const { data: recipient } = await supabaseAdmin
            .from('campaign_recipients')
            .select('id, campaign_id')
            .eq('id', rid)
            .maybeSingle()
          if (recipient) {
            // L'index unique partiel garantit une seule ouverture par destinataire.
            await supabaseAdmin.from('campaign_events').insert({
              campaign_id: recipient.campaign_id,
              recipient_id: recipient.id,
              event_type: 'open',
              user_agent: request.headers.get('user-agent'),
            })
          }
        } catch (error) {
          console.error('[track-open] failed', error)
        }
        return pixelResponse()
      },
    },
  },
})
