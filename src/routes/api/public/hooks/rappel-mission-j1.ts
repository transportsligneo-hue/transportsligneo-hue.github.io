/**
 * Rappel automatique J-1 aux convoyeurs (email + push).
 *
 * Appelé par pg_cron (header `apikey`). Accepte aussi `{ attributionId }`
 * pour un envoi immédiat quand une mission est attribuée à moins de 24h.
 */
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hooks/rappel-mission-j1')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get('apikey') ?? ''
        const expected =
          process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'] ?? ''
        if (!expected || key !== expected) {
          return new Response('Unauthorized', { status: 401 })
        }

        let body: { attributionId?: string; force?: boolean } = {}
        try {
          body = (await request.json()) as typeof body
        } catch {
          body = {}
        }

        const { runMissionReminders, sendMissionReminder } = await import('@/lib/mission-reminder.server')

        if (body.attributionId) {
          const res = await sendMissionReminder(body.attributionId, { force: body.force === true })
          return Response.json(res)
        }

        const res = await runMissionReminders()
        return Response.json({ ok: true, ...res })
      },
    },
  },
})
