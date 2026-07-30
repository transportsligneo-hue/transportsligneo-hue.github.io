import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const convertDemandeToMissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ demandeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: isAdmin, error: adminRoleError }, { data: isSuperAdmin, error: superRoleError }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
    ]);
    if (adminRoleError) throw adminRoleError;
    if (superRoleError) throw superRoleError;
    if (!isAdmin && !isSuperAdmin) throw new Error("Accès administrateur requis");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc(
      "service_convert_demande_to_missions" as never,
      { _demande_id: data.demandeId, _converted_by: context.userId } as never,
    );
    if (error) throw error;
    return (rows ?? []) as Array<{ mission_id: string; leg: string; numero: string }>;
  });