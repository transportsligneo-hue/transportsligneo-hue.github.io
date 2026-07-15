import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Server-side verification that the caller is an admin (or super_admin).
 * Called from the admin route `beforeLoad` so that the admin UI cannot be
 * rendered by simply bypassing the client-side role check.
 */
export const verifyAdminAccess = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' }),
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' }),
    ])
    if (!isAdmin && !isSuper) {
      throw new Response('Forbidden', { status: 403 })
    }
    return { ok: true as const, role: isSuper ? ('super_admin' as const) : ('admin' as const) }
  })
