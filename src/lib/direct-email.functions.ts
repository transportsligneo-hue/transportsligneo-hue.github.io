import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { buildCampaignHtml, buildCampaignText, type CampaignContent } from '@/lib/campaigns/render'

export interface DirectEmailInput extends CampaignContent {
  to: string
  prenom?: string | null
  nom?: string | null
  entreprise?: string | null
}

/** Envoi d'un email ponctuel (hors campagne) à un destinataire choisi manuellement. */
export const sendDirectEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: DirectEmailInput) => {
    const to = String(input?.to ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(to)) {
      throw new Error("Adresse email invalide (exemple : nom@gmail.com)")
    }
    if (!String(input?.subject ?? '').trim()) throw new Error("L'objet est obligatoire")
    if (!String(input?.message ?? '').trim()) throw new Error('Le message est vide')
    return { ...input, to }
  })
  .handler(async ({ data, context }) => {
    const authContext = context as { supabase: any; userId: string }
    const { data: isAdmin } = await authContext.supabase.rpc('has_role', {
      _user_id: authContext.userId,
      _role: 'admin',
    })
    if (!isAdmin) {
      const { data: isSuper } = await authContext.supabase.rpc('has_role', {
        _user_id: authContext.userId,
        _role: 'super_admin',
      })
      if (!isSuper) throw new Error('Forbidden')
    }

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
          : res.reason === 'invalid_recipient'
            ? "Adresse email invalide (exemple : nom@gmail.com)"
          : "Envoi impossible pour le moment",
      )
    }

    return { ok: true as const, to: data.to }
  })
