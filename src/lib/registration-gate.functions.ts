import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const gateSchema = z.object({
  client: z.boolean(),
  pro: z.boolean(),
  flotte: z.boolean(),
  convoyeur: z.boolean(),
});

export const setRegistrationGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => gateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin && !isSuper) {
      throw new Error("Accès refusé.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "registration_gate", value: data }, { onConflict: "key" });
    if (error) throw new Error("Enregistrement impossible.");
    return { ok: true as const };
  });
