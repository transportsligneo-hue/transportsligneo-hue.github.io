/**
 * handoff.functions.ts
 *
 * Server functions pour le handoff "scan depuis mon téléphone" :
 *  - createHandoffSession : appelée par le PC (utilisateur connecté), crée
 *    un token à usage limité (10 min) et renvoie l'URL publique + code court.
 *  - closeHandoffSession : ferme la session (bouton "j'ai fini" côté PC).
 *
 * La réception des extractions se fait via Realtime Supabase sur la table
 * `scan_handoff_extractions`. Le push depuis le mobile passe par la server
 * route publique `/api/public/scan/handoff-extract` (aucun bearer requis).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createHandoffSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        context: z.enum(["admin_mission", "client_reservation", "pro_demande"]).default("admin_mission"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("create_scan_handoff_session", {
      _context: data.context,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Session non créée");
    return {
      id: row.id as string,
      token: row.token as string,
      short_code: row.short_code as string,
      expires_at: row.expires_at as string,
    };
  });

export const closeHandoffSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("scan_handoff_sessions").delete().eq("id", data.id);
    return { ok: true };
  });
