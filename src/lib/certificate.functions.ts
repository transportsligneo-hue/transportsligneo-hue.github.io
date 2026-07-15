import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const verifyCertificate = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("verify_certificate", {
      _token: data.token,
    });
    if (error) return { valid: false as const };
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || (row as { valid?: boolean }).valid === false) {
      return { valid: false as const };
    }
    const r = row as { certificate_number: string; full_name: string; issued_at: string };
    return {
      valid: true as const,
      certificate_number: r.certificate_number,
      full_name: r.full_name,
      issued_at: r.issued_at,
    };
  });
