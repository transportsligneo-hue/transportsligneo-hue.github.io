/**
 * analyzePhotoDamage — détecte les défauts visibles sur une photo de véhicule.
 * Retourne des bounding boxes normalisées (0-1) + labels + confidence.
 * L'utilisateur reste seul décideur — ces données ne sont JAMAIS persistées
 * automatiquement, elles alimentent l'AiAssistantPanel côté convoyeur.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PhotoAnalysis } from "./types";

const Input = z.object({
  image_data_url: z.string().min(100).max(15_000_000),
  zone_hint: z.string().max(80).optional(),
});

type Result = { ok: true; analysis: PhotoAnalysis } | { ok: false; error: string };

const SYSTEM_PROMPT = `Tu es un inspecteur automobile expert. Analyse la photo fournie et détecte tous les défauts visibles sur le véhicule.
Renvoie des bounding boxes en coordonnées normalisées (0.0 à 1.0), où (0,0) est le coin haut-gauche.
Types de défauts autorisés : rayure, bosse, impact, eclat_peinture, jante_abimee, pare_brise_fissure, optique_cassee, retroviseur_endommage, pare_chocs, capot, aile, portiere, coffre, toit, bas_de_caisse.
Sois PRUDENT : ne signale que ce qui est clairement visible. En cas de doute, réduis la confidence.
Confidence 0.9+ = très sûr ; 0.7-0.9 = probable ; 0.5-0.7 = incertain ; <0.5 = ne pas remonter.
Signale la qualité globale de la photo (good/average/poor) et donne des warnings si nécessaire.`;

const TOOL = {
  name: "report_damages",
  description: "Retourne la liste des défauts détectés.",
  parameters: {
    type: "object",
    properties: {
      detections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: {
              type: "string",
              enum: ["rayure","bosse","impact","eclat_peinture","jante_abimee","pare_brise_fissure","optique_cassee","retroviseur_endommage","pare_chocs","capot","aile","portiere","coffre","toit","bas_de_caisse"],
            },
            confidence: { type: "number" },
            bbox: {
              type: "object",
              properties: {
                x: { type: "number" }, y: { type: "number" },
                w: { type: "number" }, h: { type: "number" },
              },
              required: ["x","y","w","h"],
            },
            zone: { type: "string" },
            description: { type: "string" },
          },
          required: ["label","confidence","bbox"],
        },
      },
      overall_quality: { type: "string", enum: ["good","average","poor"] },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["detections","overall_quality"],
  },
};

export const analyzePhotoDamage = createServerFn({ method: "POST" })
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
    // Cette fn couvre plusieurs capacités défauts ; on exige au moins une active
    const anyDetect = ["detect_scratches","detect_dents","detect_impacts","detect_rims","detect_windshield","detect_mirrors","detect_lights"]
      .some(k => settings?.caps?.[k] !== false);
    if (!anyDetect) return { ok: false, error: "Détection défauts désactivée" };

    const model = pickModel("detect_scratches", settings?.model_overrides);
    const res = await callVisionTool<PhotoAnalysis>({
      apiKey, model,
      systemPrompt: SYSTEM_PROMPT,
      userText: data.zone_hint
        ? `Photo axée sur : ${data.zone_hint}. Analyse-la.`
        : "Analyse cette photo du véhicule.",
      imageUrls: [data.image_data_url],
      tool: TOOL,
      timeoutMs: 20_000,
    });

    await logAiUsage({
      userId: context.userId, capability: "detect_scratches",
      model_id: res.model_id, latency_ms: res.latency_ms,
      success: res.ok, error_code: res.ok ? undefined : res.error_code,
    });

    if (!res.ok) return { ok: false, error: res.error };
    // Filtrage confidence < 0.5 côté serveur (sécurité additionnelle)
    const filtered: PhotoAnalysis = {
      detections: (res.data.detections ?? []).filter(d => (d.confidence ?? 0) >= 0.5),
      overall_quality: res.data.overall_quality ?? "average",
      warnings: res.data.warnings ?? [],
    };
    return { ok: true, analysis: filtered };
  });
