import { createFileRoute } from '@tanstack/react-router'
import { resolveShortLink } from '@/lib/short-links.server'

export const Route = createFileRoute('/a/$code')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const target = await resolveShortLink(params.code)
        if (!target) {
          return new Response('Lien introuvable ou expiré.', { status: 404 })
        }
        return new Response(null, {
          status: 302,
          headers: { Location: target },
        })
      },
    },
  },
  component: () => null,
})
