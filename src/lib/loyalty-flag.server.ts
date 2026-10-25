/**
 * Interrupteur « Compte Kilomètres » côté serveur.
 * Réglé dans l'admin (table feature_flags). Quand il est désactivé, plus aucun mail,
 * SMS, avoir ni clôture de période n'est déclenché. Les kilomètres déjà cumulés sont conservés.
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export async function isLoyaltyEnabled(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('feature_flags')
    .select('enabled')
    .eq('key', 'compte_kilometres')
    .maybeSingle()
  // En cas de doute (erreur de lecture), on n'envoie rien.
  if (error) return false
  // Pas de ligne = jamais réglé = activé par défaut (comme dans l'admin).
  return data ? Boolean(data.enabled) : true
}
