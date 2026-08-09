import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { sendTestSms, type TestSmsResponse } from '@/lib/sms-test.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/test-sms')({
  head: () => ({
    meta: [
      { title: 'Test SMS Twilio — Transports Ligneo' },
      { name: 'description', content: 'Page temporaire de test d’envoi de SMS via Twilio pour Transports Ligneo.' },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'Test SMS Twilio — Transports Ligneo' },
      { property: 'og:description', content: 'Page temporaire de test d’envoi de SMS via Twilio.' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: TestSmsPage,
})

function prettify(raw?: string) {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function TestSmsPage() {
  const send = useServerFn(sendTestSms)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestSmsResponse | null>(null)

  const onSend = async () => {
    setLoading(true)
    setResult(null)
    try {
      setResult(await send({ data: { phone } }))
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Test SMS Twilio</h1>
      <p className="text-sm text-muted-foreground">
        Page temporaire. Saisissez le numéro destinataire puis envoyez « Test Transports Ligneo ».
      </p>
      <Input
        type="tel"
        placeholder="+33 6 12 34 56 78"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <Button onClick={onSend} disabled={loading || phone.trim().length < 6}>
        {loading ? 'Envoi…' : 'Envoyer le SMS de test'}
      </Button>

      {loading && <p className="text-sm text-muted-foreground">Envoi en cours…</p>}

      {result && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            result.ok ? 'border-primary/40 bg-primary/5' : 'border-destructive/40 bg-destructive/5'
          }`}
        >
          <p className="font-medium">
            {result.ok ? 'SMS envoyé' : 'Échec de l’envoi'}
            {typeof result.status === 'number' ? ` — HTTP ${result.status}` : ''}
          </p>
          {result.to && <p className="mt-1 text-muted-foreground">Destinataire : {result.to}</p>}
          {result.sid && <p className="text-muted-foreground">SID : {result.sid}</p>}
          {result.error && <p className="mt-1 text-destructive">Erreur : {result.error}</p>}
          {result.raw && (
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
              {prettify(result.raw)}
            </pre>
          )}
        </div>
      )}
    </main>
  )
}
