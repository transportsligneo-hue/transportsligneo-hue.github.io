import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Adresse de facturation d'un client (fiche admin).
 * Lecture / écriture réservées aux admins, via le client service-role (côté serveur).
 */
async function assertAdmin(supabase: any, userId: string) {
  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('actif', true)
  const isAdmin = (roleRows ?? []).some(
    (r: { role: string }) => r.role === 'admin' || r.role === 'super_admin',
  )
  if (!isAdmin) throw new Error('Accès réservé aux administrateurs.')
}

export const getClientBillingAddress = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: row, error } = await supabaseAdmin
      .from('profiles')
      .select('adresse, adresse_facturation')
      .eq('user_id', data.userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const r = (row ?? {}) as { adresse?: string | null; adresse_facturation?: string | null }
    return { adresse: r.adresse ?? '', adresse_facturation: r.adresse_facturation ?? '' }
  })

export const setClientBillingAddress = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), adresse_facturation: z.string().trim().max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ adresse_facturation: data.adresse_facturation || null } as never)
      .eq('user_id', data.userId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
