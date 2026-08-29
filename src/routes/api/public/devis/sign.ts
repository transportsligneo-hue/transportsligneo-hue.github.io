/**
 * Signature publique d'un devis par code OTP (SMS prioritaire, e-mail en repli).
 * Endpoint public : l'accès est protégé par le token non devinable du devis.
 */
import { createFileRoute } from '@tanstack/react-router'

function clientMeta(request: Request) {
  return {
    ip:
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null,
    userAgent: request.headers.get('user-agent'),
  }
}

export const Route = createFileRoute('/api/public/devis/sign')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { token?: string; action?: string; code?: string }
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Requête invalide' }, { status: 400 })
        }
        const token = String(body?.token ?? '')
        const action = body?.action === 'verify' ? 'verify' : 'request'
        if (!/^[0-9a-f]{16,128}$/i.test(token)) {
          return Response.json({ error: 'Lien invalide' }, { status: 400 })
        }

        const mod = await import('@/lib/devis-public.server')
        const devis = await mod.loadDevisByToken(token)
        if (!devis) return Response.json({ error: 'Devis introuvable' }, { status: 404 })

        try {
          if (action === 'request') {
            const res = await mod.sendPublicDevisOtp(devis, clientMeta(request))
            return Response.json(res)
          }
          const code = String(body?.code ?? '')
          if (!/^\d{6}$/.test(code)) {
            return Response.json({ error: 'Code invalide' }, { status: 400 })
          }
          const res = await mod.verifyPublicDevisOtp(devis, code, clientMeta(request))
          return Response.json(res)
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Opération impossible'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
  },
})
