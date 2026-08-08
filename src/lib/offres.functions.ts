import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Notifie l'admin par email qu'un convoyeur vient de candidater / contre-offrir.
 * Appelée juste après la RPC `driver_apply_to_mission` (best effort, non bloquant).
 */
export const notifyAdminNouvelleOffre = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trajetId: string; prixPropose: number; message?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { sendTransactionalEmailServer, getAdminNotificationEmail } = await import('@/server/email-send')

    const [{ data: trajet }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from('trajets')
        .select('numero_mission, depart, arrivee, prix_convoyeur')
        .eq('id', data.trajetId)
        .maybeSingle(),
      supabaseAdmin
        .from('profiles')
        .select('prenom, nom')
        .eq('user_id', context.userId)
        .maybeSingle(),
    ])

    const adminEmail = await getAdminNotificationEmail()
    const convoyeur = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || 'Convoyeur'

    return sendTransactionalEmailServer({
      templateName: 'nouvelle-offre-admin',
      recipientEmail: adminEmail,
      idempotencyKey: `offre-${data.trajetId}-${context.userId}-${Date.now()}`,
      templateData: {
        numero: trajet?.numero_mission ?? undefined,
        convoyeur,
        depart: trajet?.depart ?? undefined,
        arrivee: trajet?.arrivee ?? undefined,
        prixInitial: trajet?.prix_convoyeur ?? undefined,
        prixPropose: data.prixPropose,
        message: data.message ?? undefined,
      },
    })
  })
