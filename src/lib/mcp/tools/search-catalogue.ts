import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_catalogue",
  title: "Catalogue des missions disponibles",
  description:
    "Consulte le catalogue public des missions ouvertes aux convoyeurs indépendants validés. Renvoie les offres visibles selon les règles de la plateforme.",
  inputSchema: {
    ville: z.string().optional().describe("Ville de départ ou d'arrivée (recherche partielle)."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ ville, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("mission_offres")
      .select("id, numero_mission, statut, ville_depart, ville_arrivee, date_depart_prevue, remuneration_convoyeur")
      .order("date_depart_prevue", { ascending: true, nullsFirst: false })
      .limit(limit ?? 20);
    if (ville) q = q.or(`ville_depart.ilike.%${ville}%,ville_arrivee.ilike.%${ville}%`);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Erreur: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { offres: data },
    };
  },
});
