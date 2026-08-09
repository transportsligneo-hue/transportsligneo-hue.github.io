import { createFileRoute } from '@tanstack/react-router'
import { resolveShortLink } from '@/lib/short-links.server'

export const Route = createFileRoute('/a/$code')({
  component: () => null,
  loader: async ({ params }) => {
    const target = await resolveShortLink(params.code)
    if (!target) throw new Error('Lien introuvable ou expiré.')
    return { target }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: 'Transports Ligneo' },
      { name: 'description', content: 'Redirection en cours...' },
      { httpEquiv: 'refresh', content: `0;url=${loaderData.target}` },
    ],
  }),
})
