import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, MailX, Loader2, AlertTriangle } from 'lucide-react'

export const Route = createFileRoute('/desinscription')({
  head: () => ({
    meta: [
      { title: 'Désinscription emails — Transports Ligneo' },
      {
        name: 'description',
        content:
          "Gérez votre abonnement aux communications marketing de Transports Ligneo et désinscrivez-vous en un clic.",
      },
      { property: 'og:title', content: 'Désinscription emails — Transports Ligneo' },
      {
        property: 'og:description',
        content: 'Désinscrivez-vous des communications marketing de Transports Ligneo.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({ rid: (search['rid'] as string) || '' }),
  component: UnsubscribePage,
})

type State = 'loading' | 'ready' | 'already' | 'done' | 'invalid'

function UnsubscribePage() {
  const { rid } = Route.useSearch()
  const [state, setState] = useState<State>('loading')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!rid) {
      setState('invalid')
      return
    }
    fetch(`/api/public/campaign-unsubscribe?rid=${encodeURIComponent(rid)}`)
      .then((r) => r.json())
      .then((data: { valid: boolean; email?: string; alreadyUnsubscribed?: boolean }) => {
        if (!data.valid) return setState('invalid')
        setEmail(data.email ?? '')
        setState(data.alreadyUnsubscribed ? 'already' : 'ready')
      })
      .catch(() => setState('invalid'))
  }, [rid])

  const confirm = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/campaign-unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rid }),
      })
      setState(res.ok ? 'done' : 'invalid')
    } catch {
      setState('invalid')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-pro-bg px-4 py-16">
      <Card className="w-full max-w-md p-8 text-center space-y-5">
        {state === 'loading' && (
          <>
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Vérification du lien…</p>
          </>
        )}

        {state === 'invalid' && (
          <>
            <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" />
            <h1 className="text-xl font-semibold">Lien invalide</h1>
            <p className="text-sm text-muted-foreground">
              Ce lien de désinscription n'est plus valide. Contactez-nous à
              contact@transportsligneo.fr pour toute demande.
            </p>
          </>
        )}

        {state === 'ready' && (
          <>
            <MailX className="h-10 w-10 mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Se désinscrire</h1>
            <p className="text-sm text-muted-foreground">
              Confirmez pour ne plus recevoir les communications marketing de Transports Ligneo
              {email ? ` sur ${email}` : ''}. Les emails liés à vos missions et factures continueront
              d'être envoyés.
            </p>
            <Button onClick={confirm} disabled={submitting} className="w-full">
              {submitting ? 'Enregistrement…' : 'Confirmer ma désinscription'}
            </Button>
          </>
        )}

        {(state === 'done' || state === 'already') && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
            <h1 className="text-xl font-semibold">
              {state === 'done' ? 'Désinscription enregistrée' : 'Déjà désinscrit'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Vous ne recevrez plus d'emails marketing de Transports Ligneo.
            </p>
          </>
        )}
      </Card>
    </main>
  )
}
