/**
 * Envoi de SMS via Brevo (ex-Sendinblue), à travers le connector gateway Lovable.
 *
 * Doc : https://developers.brevo.com/reference/sendtransacsms
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

/** Brevo attend le numéro au format international SANS le "+" (ex : 33612345678). */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return `33${digits.slice(1)}`
  return digits
}

/** Nom d'expéditeur alphanumérique : max 11 caractères en France. */
function normalizeSender(from?: string): string {
  const raw = (from || 'Ligneo').replace(/[^A-Za-z0-9 ]/g, '').trim()
  const value = raw.length > 0 ? raw.slice(0, 11) : 'Ligneo'
  return value
}

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/brevo'

export async function sendSms(params: {
  to: string
  body: string
  from?: string
}): Promise<SmsResult> {
  if (!isValidPhone(params.to)) {
    return { ok: false, error: 'Numéro de téléphone invalide.' }
  }

  const LOVABLE_API_KEY = process.env['LOVABLE_API_KEY']
  const BREVO_API_KEY = process.env['BREVO_API_KEY']
  if (!LOVABLE_API_KEY || !BREVO_API_KEY) {
    return { ok: false, error: 'Configuration SMS incomplète (clé Brevo manquante).' }
  }

  const recipient = normalizePhone(params.to)
  // Pas de troncature à 160 caractères : un SMS plus long est simplement
  // découpé en plusieurs segments concaténés par l'opérateur (facturation
  // multi-crédits). Tronquer couperait le lien d'avis en plein milieu.
  const content = params.body.trim().slice(0, 1600)

  try {
    const response = await fetch(`${GATEWAY_URL}/transactionalSMS/sms`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: normalizeSender(params.from),
        recipient,
        content,
        type: 'transactional',
      }),
    })

    const raw = await response.text()
    if (!response.ok) {
      console.error(`Brevo SMS error [${response.status}]: ${raw}`)
      return { ok: false, error: `Brevo ${response.status}: ${raw.slice(0, 160)}` }
    }

    let messageId: string | undefined
    try {
      const parsed = JSON.parse(raw) as { messageId?: string | number; reference?: string }
      messageId = parsed.messageId != null ? String(parsed.messageId) : parsed.reference
    } catch {
      /* réponse non JSON : on garde le succès HTTP */
    }
    return { ok: true, sid: messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Brevo SMS exception:', msg)
    return { ok: false, error: msg }
  }
}
