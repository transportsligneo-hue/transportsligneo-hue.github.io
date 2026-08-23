import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { buildCampaignHtml, buildCampaignText, type CampaignContent } from '@/lib/campaigns/render'

export interface DirectEmailInput extends CampaignContent {
  to: string
  prenom?: string | null
  nom?: string | null
  entreprise?: string | null
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc('has_role', {
    _user_id: context.userId,
    _role: 'admin',
  })
  if (isAdmin) return
  const { data: isSuper } = await context.supabase.rpc('has_role', {
    _user_id: context.userId,
    _role: 'super_admin',
  })
  if (!isSuper) throw new Error('Forbidden')
}

/** Envoi d'un email ponctuel (hors campagne) à un destinataire choisi manuellement. */
export const sendDirectEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: DirectEmailInput) => {
    const to = String(input?.to ?? '').trim().toLowerCase()
    if (!to.includes('@')) throw new Error('Adresse email invalide')
    if (!String(input?.subject ?? '').trim()) throw new Error("L'objet est obligatoire")
    if (!String(input?.message ?? '').trim()) throw new Error('Le message est vide')
    return { ...input, to }
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any)

    const gatewayKey = process.env['LOVABLE_API_KEY']
    const resendKey = process.env['RESEND_API_KEY']
    if (!gatewayKey || !resendKey) throw new Error("Le service d'envoi email n'est pas configuré")

    const vars = {
      prenom: data.prenom ?? '',
      nom: data.nom ?? '',
      entreprise: data.entreprise ?? '',
      solde_km: 0,
    }

    const html = buildCampaignHtml({ campaign: data, vars })
    const text = buildCampaignText(data, vars)

    const response = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gatewayKey}`,
        'X-Connection-Api-Key': resendKey,
      },
      body: JSON.stringify({
        from: `${data.sender_name || 'Transports Ligneo'} <contact@transportsligneo.fr>`,
        to: [data.to],
        subject: data.subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[send-direct-email] provider error [${response.status}]: ${errorBody}`)
      throw new Error(`Envoi refusé [${response.status}]: ${errorBody.slice(0, 300)}`)
    }

    return { ok: true as const, to: data.to }
  })
