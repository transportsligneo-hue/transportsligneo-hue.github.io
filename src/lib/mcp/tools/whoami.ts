import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Qui suis-je ?",
  description:
    "Retourne l'identité de l'utilisateur connecté (email, rôle, statut convoyeur/client) sur la plateforme Transports Ligneo.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const [{ data: roles }, { data: convoyeur }, { data: client }] = await Promise.all([
      sb.from("user_roles").select("role").eq("user_id", userId),
      sb.from("convoyeurs").select("id,statut,nom,prenom,email").eq("user_id", userId).maybeSingle(),
      sb.from("clients").select("id,type_client,email,nom,prenom,raison_sociale").eq("user_id", userId).maybeSingle(),
    ]);
    const summary = {
      user_id: userId,
      email: ctx.getUserEmail(),
      roles: (roles ?? []).map((r: { role: string }) => r.role),
      convoyeur: convoyeur ?? null,
      client: client ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});

// tell zod it is used to avoid tree-shaking of the peer dep
void z;
