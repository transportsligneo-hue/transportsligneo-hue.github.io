import { createServerFn } from "@tanstack/react-start";
import rows from "./formation-seed.tmp.json";

// Temporaire : chargement unique du nouveau contenu de formation.
export const seedFormation = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: string[] = [];
  for (const r of rows as Array<Record<string, unknown> & { order_index: number }>) {
    const { order_index, ...rest } = r;
    const { data, error } = await supabaseAdmin
      .from("modules")
      .update({ ...rest, last_updated: new Date().toISOString() } as never)
      .eq("order_index", order_index)
      .eq("is_active", true)
      .select("id");
    out.push(`${order_index}:${error ? error.message : data?.length}`);
  }
  return out;
});
