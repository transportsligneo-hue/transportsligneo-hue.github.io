import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Envoie au nouvel utilisateur (compte créé par un admin) un email de bienvenue
 * contenant un lien sécurisé lui permettant de CHOISIR lui-même son mot de passe.
 * L'admin n'a donc jamais à inventer ni communiquer un mot de passe.
 */

const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*(transportsligneo\.fr|lovable\.app)$/i

interface Input {
  email: string
  prenom?: string | null
  role?: string | null
  origin?: string | null
}

export const sendAccountAccessInvite = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => data)
  .handler(async ({ data, context }) => {
    const email = String(data.email ?? '').trim().toLowerCase()
    if (!email) throw new Error('Email manquant')

    const { data: roles } = await context.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', context.userId)
      .eq('actif', true)
    const isAdmin = (roles ?? []).some(
      (r: { role: string }) => r.role === 'admin' || r.role === 'super_admin',
    )
    if (!isAdmin) throw new Error('Action réservée aux administrateurs')

    const origin =
      data.origin && ALLOWED_ORIGIN.test(data.origin)
        ? data.origin
        : 'https://www.transportsligneo.fr'

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${origin}/reset-password` },
    })
    if (linkErr || !link?.properties?.action_link) {
      throw new Error(linkErr?.message ?? 'Lien de création de mot de passe indisponible')
    }

    const espace =
      data.role === 'convoyeur'
        ? 'espace convoyeur'
        : data.role === 'manager' || data.role === 'sous_traitant'
          ? 'espace professionnel'
          : data.role === 'admin' || data.role === 'super_admin'
            ? 'accès administrateur'
            : 'espace client'

    const { sendTransactionalEmailServer } = await import('@/server/email-send')
    const res = await sendTransactionalEmailServer({
      templateName: 'acces-compte',
      recipientEmail: email,
      idempotencyKey: `acces-compte-${email}-${Date.now()}`,
      templateData: {
        prenom: data.prenom ?? '',
        espace,
        email,
        lienMotDePasse: link.properties.action_link,
      },
    })
    if (!res.success) throw new Error(res.reason ?? "Envoi de l'email impossible")

    return { sent: true as const, email }
  })
