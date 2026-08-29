/** Lecture publique d'un devis via son token non devinable (champs limités). */
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/devis/view')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get('token') ?? ''
        if (!/^[0-9a-f]{16,128}$/i.test(token)) {
          return Response.json({ error: 'Lien invalide' }, { status: 400 })
        }
        const mod = await import('@/lib/devis-public.server')
        const devis = await mod.loadDevisByToken(token)
        if (!devis) return Response.json({ error: 'Devis introuvable' }, { status: 404 })
        return new Response(JSON.stringify(mod.toPublicView(devis)), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        })
      },
    },
  },
})
