/**
 * admin-notifications — helper centralisé pour créer des notifications admin
 * (visibles dans /admin via la table admin_notifications) ET déclencher l'email
 * transactionnel correspondant lorsqu'un template est associé.
 *
 * Usage : `notifyAdmin({ type: 'incident', titre, message, link, entityId })`.
 * Tolère les erreurs silencieusement (best-effort) — ne casse jamais le flow utilisateur.
 */
import { supabase } from "@/integrations/supabase/client";

export type AdminNotificationType =
  | "incident"
  | "estimation"
  | "devis"
  | "mission_acceptee"
  | "mission_offre"
  | "mission_terminee"
  | "client_action"
  | "driver_action"
  | "b2b_lead"
  | "b2b_paiement";

export interface NotifyAdminInput {
  type: AdminNotificationType;
  titre: string;
  message?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function notifyAdmin(input: NotifyAdminInput): Promise<void> {
  try {
    // Server-side validated RPC (SECURITY DEFINER, type whitelist enforced).
    const { error } = await supabase.rpc("create_admin_notification" as never, {
      _type: input.type,
      _titre: input.titre,
      _message: input.message ?? null,
      _link: input.link ?? null,
      _entity_type: input.entityType ?? null,
      _entity_id: input.entityId ?? null,
      _metadata: (input.metadata ?? {}) as never,
    } as never);
    if (error) console.warn("[notifyAdmin] rpc failed", error);
  } catch (err) {
    console.warn("[notifyAdmin] insert failed", err);
  }
}
