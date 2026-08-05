/**
 * Helpers serveur pour la gestion des clés API et webhooks depuis l'espace B2B.
 * Server-only (jamais importé côté client).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Vérifie que l'utilisateur appartient bien à l'organisation (via RLS lecture membre). */
export async function assertOrgAccess(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<void> {
  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (member) return;

  const { data: org } = await supabase
    .from("organizations")
    .select("id, created_by")
    .eq("id", organizationId)
    .maybeSingle();
  if (org?.created_by === userId) return;

  throw new Error("Accès refusé à cette organisation.");
}

export function keyPreview(raw: string) {
  return {
    key_prefix: raw.slice(0, raw.lastIndexOf("_") + 1),
    key_last4: raw.slice(-4),
  };
}
