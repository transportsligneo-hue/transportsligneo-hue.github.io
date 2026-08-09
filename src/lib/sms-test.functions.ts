import { createServerFn } from '@tanstack/react-start'

export interface TestSmsResponse {
  ok: boolean
  status?: number
  sid?: string
  error?: string
  raw?: string
  to?: string
}

export const sendTestSms = createServerFn({ method: 'POST' })
  .inputValidator((data: { phone: string }) => {
    if (!data || typeof data.phone !== 'string' || data.phone.trim().length < 6) {
      throw new Error('Numéro de téléphone requis')
    }
    return { phone: data.phone.trim() }
  })
  .handler(async ({ data }): Promise<TestSmsResponse> => {
    const digits = data.phone.replace(/\D/g, '')
    let to = `+${digits}`
    if (digits.startsWith('0') && !digits.startsWith('00')) to = `+33${digits.slice(1)}`
    else if (digits.startsWith('00')) to = `+${digits.slice(2)}`

    const LOVABLE_API_KEY = process.env['LOVABLE_API_KEY']
    const TWILIO_API_KEY = process.env['TWILIO_API_KEY']
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return { ok: false, error: 'Configuration SMS incomplète (clés manquantes).', to }
    }

    try {
      const response = await fetch('https://connector-gateway.lovable.dev/twilio/Messages.json', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TWILIO_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: 'Ligneo',
          Body: 'Test Transports Ligneo',
        }),
      })

      const raw = await response.text()
      if (!response.ok) {
        console.error(`Twilio gateway error [${response.status}]: ${raw}`)
        return { ok: false, status: response.status, error: `Twilio ${response.status}`, raw, to }
      }

      let sid: string | undefined
      let errorMessage: string | undefined
      try {
        const parsed = JSON.parse(raw) as { sid?: string; error_message?: string }
        sid = parsed.sid
        errorMessage = parsed.error_message ?? undefined
      } catch {
        /* réponse non JSON : on garde le brut */
      }

      if (errorMessage) {
        return { ok: false, status: response.status, error: errorMessage, raw, to }
      }
      return { ok: true, status: response.status, sid, raw, to }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Twilio send exception:', msg)
      return { ok: false, error: msg, to }
    }
  })
