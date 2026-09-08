/**
 * Import automatique des bons de commande CAT / K2 depuis Gmail.
 * Appelé par pg_cron (en-tête x-cron-secret) — jamais exposé au navigateur.
 */
import { createFileRoute } from '@tanstack/react-router'
import { verifyCronSecret } from '@/lib/cron-auth.server'

export const Route = createFileRoute('/api/public/hooks/gmail-po-sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyCronSecret(request))) {
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
