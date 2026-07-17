/**
 * photoQualityCheck — assistant photo temps réel : détecte flou, cadrage,
 * luminosité, sujet manquant. Utilisé pour un toast non-bloquant côté capture.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PhotoQuality } from "./types";

const Input = z.object({
  image_data_url: z.string().min(100).max(15_000_000),
  expected_subject: z.string().max(80).optional(),
});

type Result = { ok: true; quality: PhotoQuality } | { ok: false; error: string };

const SYSTEM_PROMPT = `Tu es un expert en contrôle qualité de photos automobiles.
Détecte flou, mauvais cadrage, luminosité insuffisante, sujet manquant.
Sois indulgent : ne remonte un problème que s'il est clairement gênant pour un inspecteur professionnel.`;

const TOOL = {
  name: "check_photo_quality",
  description: "Retourne un diagnostic qualité photo.",
  parameters: {
    type: "object",
    properties: {
      is_blurry: { type: "boolean" },
      is_too_dark: { type: "boolean" },
      is_badly_framed: { type: "boolean" },
      advice: { type: "array", items: { type: "string" } },
    },
    required: ["is_blurry","is_too_dark","is_badly_framed","advice"],
  },
};

export const photoQualityCheck = createServerFn({ method: "POST" })
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
    if (settings?.caps?.photo_assistant === false) return { ok: false, error: "Assistant photo désactivé" };

    const model = pickModel("photo_assistant", settings?.model_overrides);
    const res = await callVisionTool<PhotoQuality>({
      apiKey, model,
      systemPrompt: SYSTEM_PROMPT,
      userText: data.expected_subject
        ? `Sujet attendu : ${data.expected_subject}. Analyse la qualité.`
        : "Analyse la qualité de cette photo.",
      imageUrls: [data.image_data_url],
      tool: TOOL,
      timeoutMs: 10_000,
    });

    await logAiUsage({
      userId: context.userId, capability: "photo_assistant",
      model_id: res.model_id, latency_ms: res.latency_ms,
      success: res.ok, error_code: res.ok ? undefined : res.error_code,
    });

    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, quality: res.data };
  });
