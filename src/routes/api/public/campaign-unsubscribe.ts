import { createFileRoute } from '@tanstack/react-router'

/**
 * Désinscription marketing (RGPD).
 * GET  ?rid=... → renvoie l'email masqué pour affichage de la confirmation.
 * POST { rid }  → enregistre la désinscription.
 */
export const Route = createFileRoute('/api/public/campaign-unsubscribe')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const rid = new URL(request.url).searchParams.get('rid')
        if (!rid) return Response.json({ valid: false }, { status: 400 })
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data } = await supabaseAdmin
          .from('campaign_recipients')
          .select('id, email')
          .eq('id', rid)
          .maybeSingle()
        if (!data) return Response.json({ valid: false }, { status: 404 })
        const { data: existing } = await supabaseAdmin
          .from('client_unsubscribes')
          .select('id')
          .eq('email', data.email.toLowerCase())
          .maybeSingle()
        const [user, domain] = data.email.split('@')
        const masked = `${(user ?? '').slice(0, 2)}${'•'.repeat(Math.max((user ?? '').length - 2, 1))}@${domain ?? ''}`
        return Response.json({ valid: true, email: masked, alreadyUnsubscribed: !!existing })
      },
      POST: async ({ request }) => {
        let rid: string | undefined
        try {
          const body = (await request.json()) as { rid?: string }
          rid = body.rid
        } catch {
          return Response.json({ ok: false, error: 'invalid_body' }, { status: 400 })
        }
        if (!rid) return Response.json({ ok: false, error: 'missing_rid' }, { status: 400 })

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: recipient } = await supabaseAdmin
          .from('campaign_recipients')
          .select('id, email, client_id, campaign_id')
          .eq('id', rid)
          .maybeSingle()
        if (!recipient) return Response.json({ ok: false, error: 'not_found' }, { status: 404 })

        const { error } = await supabaseAdmin.from('client_unsubscribes').upsert(
          {
            email: recipient.email.toLowerCase(),
            client_id: recipient.client_id,
            campaign_id: recipient.campaign_id,
          },
          { onConflict: 'email' },
        )
        if (error) {
          console.error('[campaign-unsubscribe] failed', error)
          return Response.json({ ok: false, error: 'save_failed' }, { status: 500 })
        }
        return Response.json({ ok: true })
      },
    },
  },
})
