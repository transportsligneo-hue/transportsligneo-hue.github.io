import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const convertDevisToMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ devisId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: isAdmin, error: adminRoleError }, { data: isSuperAdmin, error: superRoleError }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    ]);
    if (adminRoleError) throw adminRoleError;
    if (superRoleError) throw superRoleError;
    if (!isAdmin && !isSuperAdmin) throw new Error("Accès administrateur requis");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: devis, error: devisError } = await supabaseAdmin
      .from("devis")
      .select("*")
      .eq("id", data.devisId)
      .maybeSingle();
    if (devisError) throw devisError;
    if (!devis) throw new Error("Devis introuvable");

    const { data: convertedRows, error: conversionError } = await supabaseAdmin.rpc(
      "admin_convert_devis_to_missions" as never,
      {
        _devis_id: devis.id,
        _converted_by: userId,
        _mission_status: "en_attente",
      } as never,
    );
    if (conversionError) throw conversionError;

    const rows = (convertedRows ?? []) as Array<{ mission_id: string; leg: string; numero: string | null }>;
    const mainMission = rows.find((row) => row.leg === "aller" || row.leg === "simple") ?? rows[0];
    if (!mainMission) throw new Error("Mission non créée");

    return {
      missionId: mainMission.mission_id,
      numero: mainMission.numero,
      alreadyConverted: Boolean(devis.mission_id),
      legsCreated: rows.length,
    };
  });