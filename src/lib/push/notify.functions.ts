import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const payloadSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(500).optional(),
  url: z.string().max(500).optional(),
  tag: z.string().max(100).optional(),
});

/**
 * Push to a specific user. Admin/super_admin only.
 */
export const pushToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; payload: z.infer<typeof payloadSchema> }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input.userId)) throw new Error("Invalid userId");
    return { userId: input.userId, payload: payloadSchema.parse(input.payload) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isSuper } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) throw new Error("Forbidden");
    const { sendPushToUser } = await import("@/lib/push/send.server");
    return sendPushToUser(data.userId, data.payload);
  });

/**
 * Push to every active admin. Caller must be authenticated (any role) — used
 * internally to alert staff of client-driven events (new request, devis signed…).
 */
export const pushToAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payload: z.infer<typeof payloadSchema> }) => ({
    payload: payloadSchema.parse(input.payload),
  }))
  .handler(async ({ data }) => {
    const { sendPushToRole } = await import("@/lib/push/send.server");
    return sendPushToRole("admin", data.payload);
  });

/**
 * Push to the current user (self-test).
 */
export const pushToMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payload?: z.infer<typeof payloadSchema> }) => ({
    payload: payloadSchema.parse(
      input.payload ?? { title: "Notifications activées", body: "Vous recevrez les alertes ici." }
    ),
  }))
  .handler(async ({ data, context }) => {
    const { sendPushToUser } = await import("@/lib/push/send.server");
    return sendPushToUser(context.userId, data.payload);
  });
