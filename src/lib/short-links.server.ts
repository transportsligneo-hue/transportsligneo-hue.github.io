/**
 * Raccourcisseur de liens interne pour les SMS.
 *
 * Génère un code court aléatoire, stocke la cible dans short_links,
 * et expose une URL de redirection publique /a/{code}.
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

function randomCode(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

export async function createShortLink(targetUrl: string, purpose?: string): Promise<string> {
  if (!targetUrl || !targetUrl.startsWith('http')) {
    throw new Error('URL cible invalide.')
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(CODE_LENGTH)
    const { error } = await supabaseAdmin.from('short_links').insert({
      code,
      target_url: targetUrl,
      purpose: purpose ?? null,
    })
    if (!error) {
      const origin = process.env['LIGNEO_SITE_ORIGIN'] || 'https://www.transportsligneo.fr'
      return `${origin}/a/${code}`
    }
    if ((error as any)?.code !== '23505') throw error
  }
  throw new Error('Impossible de générer un code court unique.')
}

export async function resolveShortLink(code: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('short_links')
    .select('target_url')
    .eq('code', code)
    .maybeSingle()
  if (error || !data) return null
  await supabaseAdmin
    .from('short_links')
    .update({ hits: (data as { hits?: number }).hits ?? 0 + 1 })
    .eq('code', code)
    .then(() => null, () => null)
  return data.target_url
}

