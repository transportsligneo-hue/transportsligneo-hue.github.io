/**
 * generateEdlReport — produit un rapport IA structuré, prêt à être inséré
 * dans le PDF final (edl-final-pdf.ts) sans modifier la génération existante.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  inspection_id: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export type AiReport = {
  resume: string;
  kilometrage?: string;
  fuel_percent?: number | null;
  battery_percent?: number | null;
  defauts_principaux: string[];
  equipements_manquants: string[];
  recommandations: string[];
};

type Result = { ok: true; report: AiReport } | { ok: false; error: string };

const SYSTEM_PROMPT = `Tu es un expert en rédaction de rapports d'inspection automobile.
Rédige un rapport clair, factuel, en français professionnel.
Résumé court (3-5 phrases). Défauts principaux (5 max). Équipements manquants (5 max). Recommandations (3 max).`;

const TOOL = {
  name: "write_report",
  description: "Rédige un rapport d'état des lieux.",
  parameters: {
    type: "object",
    properties: {
      resume: { type: "string" },
      kilometrage: { type: "string" },
      fuel_percent: { type: "number" },
      battery_percent: { type: "number" },
      defauts_principaux: { type: "array", items: { type: "string" } },
      equipements_manquants: { type: "array", items: { type: "string" } },
      recommandations: { type: "array", items: { type: "string" } },
    },
    required: ["resume","defauts_principaux","equipements_manquants","recommandations"],
  },
};

export const generateEdlReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const p = Input.safeParse(input);
    return p.success ? { __ok: true as const, ...p.data } : { __ok: false as const, error: "Requête invalide" };
  })
  .handler(async ({ data, context }): Promise<Result> => {
    if (!data.__ok) return { ok: false, error: data.error };
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "Service IA non configuré" };

    const { callVisionTool, logAiUsage, pickModel, getServerAiSettings } = await import("./gateway.server");
    const settings = await getServerAiSettings();
    if (settings && !settings.ai_enabled) return { ok: false, error: "IA désactivée" };
    if (settings?.caps?.auto_report === false) return { ok: false, error: "Rapport auto désactivé" };

    // Récupère les données EDL via le client RLS de l'appelant :
    // seul un utilisateur autorisé sur l'attribution (client, convoyeur, admin) peut lire l'inspection.
    let context_text = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insp, error: inspError } = await (context.supabase.from("inspections" as any) as any)
      .select("*").eq("id", data.inspection_id).maybeSingle();
    if (inspError || !insp) return { ok: false, error: "Inspection introuvable ou accès non autorisé" };
    context_text = `Contexte inspection : ${JSON.stringify(insp).slice(0, 3000)}`;

    const model = pickModel("auto_report", settings?.model_overrides);
    const userText = [
      context_text,
      data.notes ? `Notes convoyeur : ${data.notes}` : "",
      "Rédige un rapport professionnel structuré.",
    ].filter(Boolean).join("\n\n");

    const res = await callVisionTool<AiReport>({
      apiKey, model,
      systemPrompt: SYSTEM_PROMPT,
      userText,
      imageUrls: [],
      tool: TOOL,
      timeoutMs: 30_000,
    });

    await logAiUsage({
      userId: context.userId, capability: "auto_report",
      model_id: res.model_id, latency_ms: res.latency_ms,
      success: res.ok, error_code: res.ok ? undefined : res.error_code,
      metadata: { inspection_id: data.inspection_id },
    });

    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, report: res.data };
  });
