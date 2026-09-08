/**
 * Authentification des tâches planifiées internes.
 *
 * Les jobs pg_cron envoient l'en-tête `x-cron-secret`, comparé à un secret
 * stocké côté serveur uniquement (`api_internal_config.cron_secret`).
 * La clé publiable du site n'est jamais utilisée comme secret.
 */
export async function verifyCronSecret(request: Request): Promise<boolean> {
  const provided = request.headers.get('x-cron-secret') ?? ''
  if (!provided) return false

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('api_internal_config')
    .select('value')
    .eq('key', 'cron_secret')
    .maybeSingle()

  const expected = (data as { value?: string } | null)?.value ?? ''
  if (!expected || provided.length !== expected.length) return false
  return provided === expected
}
