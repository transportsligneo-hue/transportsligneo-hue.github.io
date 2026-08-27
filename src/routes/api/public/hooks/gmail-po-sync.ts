/**
 * Import automatique des bons de commande CAT / K2 depuis Gmail.
 * Appelé par pg_cron (header apikey) — jamais exposé au navigateur.
 */
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hooks/gmail-po-sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get('apikey') ?? ''
        const expected =
          process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'] ?? ''
        if (!expected || key !== expected) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const { syncPoFromGmail } = await import('@/lib/po/po-sync.server')
          const result = await syncPoFromGmail(40)
          return Response.json({ ok: true, ...result })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[gmail-po-sync] échec', message)
          return Response.json({ ok: false, error: message }, { status: 500 })
        }
      },
    },
  },
})
