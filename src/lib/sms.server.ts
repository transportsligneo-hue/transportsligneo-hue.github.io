/**
 * Envoi de SMS via Twilio (connector gateway).
 *
 * On ne logue JAMAIS les secrets ; seuls les numéros et les statuts finaux
 * sont remontés.
 */

export interface SmsResult {
  ok: boolean
  sid?: string
  error?: string
}

function isValidPhone(phone?: string | null): boolean {
  if (!phone) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && !digits.startsWith('00')) {
    return `+33${digits.slice(1)}`
  }
  if (digits.startsWith('33') && digits.length === 11) {
    return `+${digits}`
  }
  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`
  }
  return `+${digits}`
}

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'

export async function sendSms(params: {
  to: string
  body: string
  from?: string
}): Promise<SmsResult> {
  if (!isValidPhone(params.to)) {
    return { ok: false, error: 'Numéro de téléphone invalide.' }
  }

  const LOVABLE_API_KEY = process.env['LOVABLE_API_KEY']
  const TWILIO_API_KEY = process.env['TWILIO_API_KEY']
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    return { ok: false, error: 'Configuration SMS incomplète.' }
  }

  const to = normalizePhone(params.to)
  const body = params.body.slice(0, 160)

  try {
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: params.from || 'Ligneo',
        Body: body,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`Twilio gateway error [${response.status}]: ${text}`)
      return { ok: false, error: `Twilio ${response.status}: ${text.slice(0, 120)}` }
    }

    const data = (await response.json()) as { sid?: string; error_message?: string }
    if (data.error_message) {
      return { ok: false, error: data.error_message }
    }
    return { ok: true, sid: data.sid }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Twilio send exception:', msg)
    return { ok: false, error: msg }
  }
}
