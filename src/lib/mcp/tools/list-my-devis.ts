import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_devis",
  title: "Mes devis",
  description:
    "Liste les devis visibles par l'utilisateur connecté (côté client). Filtre optionnel par statut (brouillon, envoye, accepte, refuse, expire).",
  inputSchema: {
    statut: z.string().optional().describe("Filtre optionnel sur le statut du devis."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ statut, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("devis")
      .select("id, numero, statut, montant_ttc, ville_depart, ville_arrivee, date_depart, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (statut) q = q.eq("statut", statut);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Erreur: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { devis: data },
    };
  },
});
