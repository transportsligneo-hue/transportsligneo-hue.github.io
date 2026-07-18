import { supabase } from '@/integrations/supabase/client'

interface SendTransactionalEmailParams {
  templateName: string
  /** Optional when the template has a fixed `to` recipient (e.g. admin notifications). */
  recipientEmail?: string
  idempotencyKey?: string
  templateData?: Record<string, any>
  /** Logo client (URL absolue) affiché dans le shell email — auto-injecté dans templateData. */
  clientLogoUrl?: string | null
  /** Raison sociale / nom du client — auto-injecté dans templateData. */
  clientName?: string | null
  /** Type de compte client — colorise le chip du shell email (flotte / b2b). */
  accountType?: 'flotte' | 'b2b' | 'particulier' | null
}


export async function sendTransactionalEmail(params: SendTransactionalEmailParams) {
  const { data: { session } } = await supabase.auth.getSession()
  const accountTheme =
    params.accountType === 'flotte' ? 'flotte' : params.accountType === 'b2b' ? 'b2b' : undefined
  const mergedData = {
    ...(params.templateData ?? {}),
    ...(params.clientLogoUrl ? { clientLogoUrl: params.clientLogoUrl } : {}),
    ...(params.clientName ? { clientName: params.clientName } : {}),
    ...(accountTheme ? { accountTheme } : {}),
  }
  const response = await fetch('/lovable/email/transactional/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      templateName: params.templateName,
      recipientEmail: params.recipientEmail,
      idempotencyKey: params.idempotencyKey,
      templateData: mergedData,
    }),
  })
  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`)
  }
  return response.json()
}
