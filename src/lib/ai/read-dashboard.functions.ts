/**
 * readDashboard — lit le tableau de bord d'un véhicule :
 * kilométrage, autonomie, carburant/batterie, voyants allumés.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DashboardReading } from "./types";

const Input = z.object({
  image_data_url: z.string().min(100).max(15_000_000),
});

type Result = { ok: true; reading: DashboardReading } | { ok: false; error: string };

const SYSTEM_PROMPT = `Tu es un expert en lecture de tableau de bord automobile.
Extrais les valeurs visibles avec précision. Si une valeur n'est pas lisible, laisse-la vide.
Ne devine JAMAIS le kilométrage.
Pour les voyants, liste uniquement ceux clairement allumés (moteur, ABS, frein, airbag, pression_pneus, adblue, batterie, esp, entretien, huile, temperature, defaut_electrique, autre).`;

const TOOL = {
  name: "read_dashboard",
  description: "Extrait les informations du tableau de bord.",
  parameters: {
    type: "object",
    properties: {
      kilometrage: { type: "string", description: "Kilométrage exact affiché, chiffres uniquement." },
      autonomie_km: { type: "string" },
      fuel_percent: { type: "number", description: "0-100 ou null si non visible." },
      battery_percent: { type: "number", description: "0-100 ou null si non visible." },
      temperature: { type: "string" },
      warning_lights: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["warning_lights"],
  },
};

export const readDashboard = createServerFn({ method: "POST" })
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

    const model = pickModel("ocr_odometer", settings?.model_overrides);
    const res = await callVisionTool<DashboardReading>({
      apiKey, model,
      systemPrompt: SYSTEM_PROMPT,
      userText: "Lis ce tableau de bord et extrais toutes les informations visibles.",
      imageUrls: [data.image_data_url],
      tool: TOOL,
    });

    await logAiUsage({
      userId: context.userId, capability: "ocr_odometer",
      model_id: res.model_id, latency_ms: res.latency_ms,
      success: res.ok, error_code: res.ok ? undefined : res.error_code,
    });

    if (!res.ok) return { ok: false, error: res.error };
    const r = res.data;
    return {
      ok: true,
      reading: {
        kilometrage: r.kilometrage,
        autonomie_km: r.autonomie_km,
        fuel_percent: settings?.caps?.detect_fuel_level === false ? null : (r.fuel_percent ?? null),
        battery_percent: settings?.caps?.detect_battery_level === false ? null : (r.battery_percent ?? null),
        temperature: r.temperature,
        warning_lights: settings?.caps?.detect_warning_lights === false ? [] : (r.warning_lights ?? []),
        warnings: r.warnings ?? [],
      },
    };
  });
