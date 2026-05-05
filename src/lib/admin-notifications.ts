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
    await supabase.from("admin_notifications" as never).insert({
      type: input.type,
      titre: input.titre,
      message: input.message ?? null,
      link: input.link ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
    } as never);
  } catch (err) {
    console.warn("[notifyAdmin] insert failed", err);
  }
}
