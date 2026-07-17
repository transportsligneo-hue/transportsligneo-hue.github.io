/**
 * detectEquipment — analyse les photos intérieur/coffre pour lister
 * les équipements présents/absents (triangle, gilet, cric, câbles VE, etc.).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EquipmentDetection } from "./types";

const Input = z.object({
  image_data_urls: z.array(z.string().min(100).max(15_000_000)).min(1).max(6),
});

type Result = { ok: true; detection: EquipmentDetection } | { ok: false; error: string };

const CATALOG = [
  "tapis_de_sol","triangle","gilet_jaune","roue_de_secours","kit_anti_crevaison",
  "chargeur_ve","cable_type_2","cable_domestique","plage_arriere","cache_bagages",
  "manuel_utilisateur","carnet_entretien","deuxieme_cle","ecrous_antivol","kit_securite",
];

const SYSTEM_PROMPT = `Tu es un expert en inspection d'équipements automobiles. Liste les équipements présents, absents ou incertains parmi le catalogue fourni.
Catalogue : ${CATALOG.join(", ")}.
Ne devine pas : si un équipement n'est pas visible ni identifiable, mets-le dans equipements_incertains.`;

const TOOL = {
  name: "detect_equipment",
  description: "Liste les équipements détectés.",
  parameters: {
    type: "object",
    properties: {
      equipements_presents: { type: "array", items: { type: "string" } },
      equipements_absents: { type: "array", items: { type: "string" } },
      equipements_incertains: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["equipements_presents","equipements_absents","equipements_incertains"],
  },
};

export const detectEquipment = createServerFn({ method: "POST" })
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
    if (settings?.caps?.detect_equipment === false) return { ok: false, error: "Détection équipements désactivée" };

    const model = pickModel("detect_equipment", settings?.model_overrides);
    const res = await callVisionTool<EquipmentDetection>({
      apiKey, model,
      systemPrompt: SYSTEM_PROMPT,
      userText: "Analyse ces photos et liste les équipements présents/absents.",
      imageUrls: data.image_data_urls,
      tool: TOOL,
    });

    await logAiUsage({
      userId: context.userId, capability: "detect_equipment",
      model_id: res.model_id, latency_ms: res.latency_ms,
      success: res.ok, error_code: res.ok ? undefined : res.error_code,
    });

    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, detection: res.data };
  });
