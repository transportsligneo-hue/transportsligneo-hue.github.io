/**
 * Envoi d'emails transactionnels via l'API Brevo (remplace la passerelle Lovable).
 * Variables Vercel : BREVO_API_KEY (obligatoire), BREVO_SENDER_EMAIL (optionnel,
 * défaut contact@transportsligneo.fr — doit être un expéditeur validé dans Brevo).
 * Serveur uniquement.
 */
export class EmailAPIError extends Error {
  status: number
  code?: string
  retryAfterSeconds?: number
  constructor(message: string, status: number, code?: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'EmailAPIError'
    this.status = status
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function brevoSenderEmail(): string {
  return process.env['BREVO_SENDER_EMAIL'] || 'contact@transportsligneo.fr'
}

export async function sendBrevoEmail(p: {
  to: string
  fromName: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  tag?: string
}): Promise<void> {
  const apiKey = process.env['BREVO_API_KEY']
  if (!apiKey) throw new EmailAPIError('BREVO_API_KEY manquante', 500, 'not_configured')

  const body: Record<string, unknown> = {
    sender: { name: p.fromName, email: brevoSenderEmail() },
    to: [{ email: p.to }],
    subject: p.subject,
    htmlContent: p.html,
  }
  if (p.text) body['textContent'] = p.text
  if (p.replyTo) body['replyTo'] = { email: p.replyTo }
  if (p.tag) body['tags'] = [p.tag.slice(0, 100)]

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.ok) return
  const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)
  const retry = Number(res.headers.get('retry-after') ?? '') || undefined
  throw new EmailAPIError(`Brevo ${res.status} ${detail}`, res.status, undefined, retry)
}
