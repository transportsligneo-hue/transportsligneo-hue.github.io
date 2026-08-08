import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function assertAdmin(context: { supabase: any; userId: string }) {
  const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
    context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' }),
    context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' }),
  ])
  if (!isAdmin && !isSuper) throw new Error('Forbidden')
}

/** Envoi manuel d'une demande d'avis Google (admin uniquement). */
export const sendGoogleReviewRequest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attributionId: string; recipientType: 'client' | 'contact_livraison'; emailOverride?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never)
    const { sendGoogleReviewRequestServer } = await import('@/lib/google-review.server')
    return sendGoogleReviewRequestServer({
      attributionId: data.attributionId,
      recipientType: data.recipientType,
      emailOverride: data.emailOverride ?? null,
      auto: false,
      actorUserId: context.userId,
      actorLabel: 'Admin',
    })
  })
