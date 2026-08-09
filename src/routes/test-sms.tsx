import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { sendTestSms } from '@/lib/sms-test.functions'
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

function TestSmsPage() {
  const send = useServerFn(sendTestSms)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const onSend = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await send({ data: { phone } })
      setResult(res.ok ? `SMS envoyé (SID ${res.sid})` : `Échec : ${res.error}`)
    } catch (e) {
      setResult(`Erreur : ${e instanceof Error ? e.message : String(e)}`)
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
      {result && <p className="text-sm">{result}</p>}
    </main>
  )
}
