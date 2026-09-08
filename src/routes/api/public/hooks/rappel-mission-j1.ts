/**
 * Rappel automatique J-1 aux convoyeurs (email + push).
 *
 * Appelé par pg_cron (en-tête `x-cron-secret`). Accepte aussi `{ attributionId }`
 * pour un envoi immédiat quand une mission est attribuée à moins de 24h.
 */
import { createFileRoute } from '@tanstack/react-router'
import { verifyCronSecret } from '@/lib/cron-auth.server'

export const Route = createFileRoute('/api/public/hooks/rappel-mission-j1')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyCronSecret(request))) {
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
