/**
 * compareEdl — compare une photo de départ à une photo d'arrivée
 * et remonte uniquement les nouveaux défauts (delta).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EdlComparison } from "./types";

const Input = z.object({
  departure_image_url: z.string().min(20).max(15_000_000),
  arrival_image_url: z.string().min(20).max(15_000_000),
  zone: z.string().max(80).optional(),
});

type Result = { ok: true; comparison: EdlComparison } | { ok: false; error: string };

const SYSTEM_PROMPT = `Tu compares deux photos du même véhicule (départ vs arrivée).
Ne remonte QUE les défauts nouveaux (présents à l'arrivée mais absents au départ) ou disparus.
Sois strict : ne signale que des différences claires, visibles à l'œil nu.
Coordonnées bbox normalisées 0-1 sur la photo d'arrivée.
Rédige un résumé français court (2 phrases max).`;

const TOOL = {
  name: "compare_photos",
  description: "Retourne les deltas entre départ et arrivée.",
  parameters: {
    type: "object",
    properties: {
      new_damages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" }, confidence: { type: "number" },
            bbox: { type: "object", properties: {
              x: { type: "number" }, y: { type: "number" },
              w: { type: "number" }, h: { type: "number" },
            }, required: ["x","y","w","h"] },
            description: { type: "string" },
          },
          required: ["label","confidence","bbox"],
        },
      },
      removed_damages: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
    },
    required: ["new_damages","summary"],
  },
};

export const compareEdl = createServerFn({ method: "POST" })
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
    if (settings?.caps?.compare_departure_arrival === false) return { ok: false, error: "Comparaison désactivée" };

    const model = pickModel("compare_departure_arrival", settings?.model_overrides);
    const res = await callVisionTool<EdlComparison>({
      apiKey, model,
      systemPrompt: SYSTEM_PROMPT,
      userText: data.zone
        ? `Compare ces deux photos de la zone : ${data.zone}. Photo 1 = départ, photo 2 = arrivée.`
        : "Compare ces deux photos. Photo 1 = départ, photo 2 = arrivée.",
      imageUrls: [data.departure_image_url, data.arrival_image_url],
      tool: TOOL,
      timeoutMs: 30_000,
    });

    await logAiUsage({
      userId: context.userId, capability: "compare_departure_arrival",
      model_id: res.model_id, latency_ms: res.latency_ms,
      success: res.ok, error_code: res.ok ? undefined : res.error_code,
    });

    if (!res.ok) return { ok: false, error: res.error };
    return {
      ok: true,
      comparison: {
        new_damages: res.data.new_damages ?? [],
        removed_damages: res.data.removed_damages ?? [],
        summary: res.data.summary ?? "",
      },
    };
  });
