/**
 * Résolution de l'organisation cliente (utilisateurs rattachés, contact de facturation).
 * Server-only.
 */

/** Identifiants des utilisateurs rattachés à l'organisation (pour filtrer devis/missions). */
export async function orgUserIds(organizationId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: members }, { data: org }] = await Promise.all([
    supabaseAdmin.from("organization_members").select("user_id").eq("organization_id", organizationId),
    supabaseAdmin.from("organizations").select("created_by").eq("id", organizationId).maybeSingle(),
  ]);
  const ids = new Set<string>();
  for (const m of members ?? []) if (m.user_id) ids.add(m.user_id);
  if (org?.created_by) ids.add(org.created_by);
  return [...ids];
}

export interface OrgContact {
  userId: string;
  nom: string;
  prenom: string;
  email: string;
}

/** Contact par défaut utilisé pour les devis/missions créés via l'API. */
export async function orgContact(organizationId: string): Promise<OrgContact | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("legal_name, commercial_name, created_by, primary_contact_name, primary_contact_email, billing_email")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) return null;

  const ids = await orgUserIds(organizationId);
  const userId = org.created_by ?? ids[0];
  if (!userId) return null;

  const parts = (org.primary_contact_name ?? "").trim().split(/\s+/);
  return {
    userId,
    nom: parts.length > 1 ? parts.slice(1).join(" ") : (org.commercial_name ?? org.legal_name),
    prenom: parts[0] ?? "Service",
    email: org.primary_contact_email ?? org.billing_email ?? "contact@transportsligneo.fr",
  };
}
