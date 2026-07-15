import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_missions",
  title: "Mes missions",
  description:
    "Liste les missions (attributions) visibles par l'utilisateur connecté. Un convoyeur voit ses missions attribuées ; un client voit celles de ses commandes. Filtre optionnel par statut.",
  inputSchema: {
    statut: z
      .string()
      .optional()
      .describe("Filtre optionnel sur le statut de la mission (ex. 'en_cours', 'terminee', 'attribuee')."),
    limit: z.number().int().min(1).max(50).optional().describe("Nombre max de missions (défaut 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ statut, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("attributions")
      .select(
        "id, numero_mission, statut, statut_convoyeur, etape_courante, ville_depart, ville_arrivee, date_depart_prevue, created_at",
      )
      .order("date_depart_prevue", { ascending: false, nullsFirst: false })
      .limit(limit ?? 20);
    if (statut) q = q.eq("statut", statut);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Erreur: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { missions: data },
    };
  },
});
