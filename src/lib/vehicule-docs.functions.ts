import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveVehiculeDocs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { devisId: string; vin: string; recto: string; verso: string | null }) => {
    if (!i?.devisId) throw new Error("devisId requis");
    const vin = String(i.vin ?? "").trim().toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error("VIN invalide");
    if (!i.recto) throw new Error("Carte grise recto requise");
    return { ...i, vin };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    for (const p of [data.recto, data.verso]) {
      if (p && !p.startsWith(`${userId}/${data.devisId}/`)) throw new Error("Fichier non autorisé");
    }
    // Propriété vérifiée par la lecture RLS
    const { data: devis } = await supabase.from("devis").select("id, paid_at").eq("id", data.devisId).maybeSingle();
    if (!devis) throw new Error("Devis introuvable ou accès refusé");
    if (devis.paid_at) throw new Error("Devis déjà payé");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("devis")
      .update({
        vin: data.vin,
        carte_grise_recto_url: data.recto,
        carte_grise_verso_url: data.verso,
        vehicule_docs_completed: true,
      })
      .eq("id", data.devisId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
