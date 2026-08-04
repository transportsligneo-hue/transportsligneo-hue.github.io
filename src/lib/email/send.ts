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
  /** Désactive le lookup profil auto (par ex. pour un email admin interne). */
  skipProfileLookup?: boolean
}

/**
 * Auto-lookup du profil client (logo, société, type de compte) via l'email
 * destinataire. Permet à tous les call sites existants de bénéficier du
 * branding client (chip B2B/Flotte, logo dans le shell) sans avoir à
 * propager manuellement accountType partout.
 */
async function lookupClientBranding(email: string): Promise<{
  clientLogoUrl: string | null
  clientName: string | null
  accountType: 'flotte' | 'b2b' | 'particulier' | null
}> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('logo_url, societe, prenom, nom, type_client' as never)
      .eq('email', email)
      .maybeSingle()
    if (!data) return { clientLogoUrl: null, clientName: null, accountType: null }
    const p = data as {
      logo_url?: string | null
      societe?: string | null
      prenom?: string | null
      nom?: string | null
      type_client?: string | null
    }
    const type =
      p.type_client === 'flotte' ? 'flotte'
      : p.type_client === 'b2b' || !!p.societe ? 'b2b'
      : 'particulier'
    const name = p.societe || `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || null
    return { clientLogoUrl: p.logo_url ?? null, clientName: name, accountType: type }
  } catch {
    return { clientLogoUrl: null, clientName: null, accountType: null }
  }
}

export async function sendTransactionalEmail(params: SendTransactionalEmailParams) {
  const { data: { session } } = await supabase.auth.getSession()

  // Auto-lookup branding client si non fourni explicitement
  let { clientLogoUrl, clientName, accountType } = params
  if (
    !params.skipProfileLookup &&
    params.recipientEmail &&
    (clientLogoUrl === undefined || clientName === undefined || accountType === undefined)
  ) {
    const looked = await lookupClientBranding(params.recipientEmail)
    if (clientLogoUrl === undefined) clientLogoUrl = looked.clientLogoUrl
    if (clientName === undefined) clientName = looked.clientName
    if (accountType === undefined) accountType = looked.accountType
  }

  const accountTheme =
    accountType === 'flotte' ? 'flotte' : accountType === 'b2b' ? 'b2b' : undefined
  const mergedData = {
    ...(params.templateData ?? {}),
    ...(clientLogoUrl ? { clientLogoUrl } : {}),
    ...(clientName ? { clientName } : {}),
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
    let detail = response.statusText
    try {
      const payload = (await response.json()) as { error?: string }
      detail = payload.error || detail
    } catch {
      // A platform outage can return a non-JSON response.
    }
    throw new Error(`Failed to send email (${response.status}): ${detail}`)
  }
  return response.json()
}
