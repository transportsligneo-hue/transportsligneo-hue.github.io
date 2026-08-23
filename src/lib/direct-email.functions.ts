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

    const vars = {
      prenom: data.prenom ?? '',
      nom: data.nom ?? '',
      entreprise: data.entreprise ?? '',
      solde_km: 0,
    }

    const html = buildCampaignHtml({ campaign: data, vars })
    const text = buildCampaignText(data, vars)

    const { sendRawEmailServer } = await import('@/server/email-send')
    const res = await sendRawEmailServer({
      to: data.to,
      subject: String(data.subject ?? ''),
      html,
      text,
      senderName: data.sender_name,
      label: 'email_direct',
    })
    if (!res.success) {
      throw new Error(
        res.reason === 'email_suppressed'
          ? "Ce destinataire s'est désinscrit des emails"
          : "Envoi impossible pour le moment",
      )
    }

    return { ok: true as const, to: data.to }
  })
