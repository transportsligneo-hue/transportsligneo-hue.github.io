import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

const eventSchema = z.enum([
  "mission_proposee",
  "mission_attribuee",
  "mission_validee",
  "mission_annulee",
  "mission_modifiee",
  "paiement_effectue",
  "document_valide",
  "document_refuse",
  "compte_valide",
  "message",
  "test",
]);

const inputSchema = z
  .object({
    convoyeurId: uuid.optional().nullable(),
    userId: uuid.optional().nullable(),
    event: eventSchema,
    attributionId: uuid.optional().nullable(),
    trajetId: uuid.optional().nullable(),
    title: z.string().max(120).optional().nullable(),
    body: z.string().max(500).optional().nullable(),
    url: z.string().max(300).optional().nullable(),
    imageUrl: z.string().url().max(500).optional().nullable(),
    detail: z.string().max(300).optional().nullable(),
  })
  .refine((v) => !!(v.convoyeurId || v.userId || v.attributionId || v.trajetId), {
    message: "Destinataire manquant",
  });

/**
 * Envoi centralisé d'une notification push à un convoyeur (admin / super admin).
 * Toute la logique de gabarit et de nettoyage des tokens vit côté serveur.
 */
export const notifyConvoyeurEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin && !isSuper) throw new Error("Forbidden");

    const { sendConvoyeurPush } = await import("@/lib/push/driver-push.server");
    const res = await sendConvoyeurPush(data);

    // Mission attribuée à moins de 24h : le rappel J-1 part tout de suite
    // plutôt que d'attendre le prochain passage de la tâche planifiée.
    if (data.attributionId && (data.event === "mission_attribuee" || data.event === "mission_validee")) {
      const { maybeSendImminentReminder } = await import("@/lib/mission-reminder.server");
      await maybeSendImminentReminder(data.attributionId);
    }

    return res;
  });
