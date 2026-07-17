/**
 * Helpers serveur pour Lovable AI Gateway (vision + tool-calling).
 * Utilisé UNIQUEMENT côté server functions IA — jamais importé en client.
 */
import type { AiCapability } from "./types";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type GatewayResult<T> =
  | { ok: true; data: T; latency_ms: number; model_id: string }
  | { ok: false; error: string; error_code?: string; latency_ms: number; model_id: string };

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const DEFAULT_MODELS: Partial<Record<AiCapability, string>> = {
  ocr_documents: "google/gemini-2.5-flash",
  ocr_odometer: "google/gemini-2.5-flash",
  detect_fuel_level: "google/gemini-2.5-flash",
  detect_battery_level: "google/gemini-2.5-flash",
  detect_warning_lights: "google/gemini-2.5-flash",
  detect_scratches: "google/gemini-2.5-flash",
  detect_dents: "google/gemini-2.5-flash",
  detect_impacts: "google/gemini-2.5-flash",
  detect_rims: "google/gemini-2.5-flash",
  detect_windshield: "google/gemini-2.5-flash",
  detect_mirrors: "google/gemini-2.5-flash",
  detect_lights: "google/gemini-2.5-flash",
  detect_equipment: "google/gemini-2.5-flash",
  compare_departure_arrival: "google/gemini-2.5-pro",
  auto_report: "google/gemini-2.5-pro",
  smart_suggestions: "google/gemini-2.5-flash",
  photo_assistant: "google/gemini-2.5-flash",
};

export function pickModel(capability: AiCapability, overrides: Record<string, string> = {}): string {
  return overrides[capability] || DEFAULT_MODELS[capability] || "google/gemini-2.5-flash";
}

/**
 * Appel générique : renvoie l'objet parsé du premier tool_call.
 */
export async function callVisionTool<T>(opts: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
  imageUrls: string[];
  tool: ToolSpec;
  timeoutMs?: number;
}): Promise<GatewayResult<T>> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    const content: Array<Record<string, unknown>> = [{ type: "text", text: opts.userText }];
    for (const url of opts.imageUrls) content.push({ type: "image_url", image_url: { url } });
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content },
        ],
        tools: [{ type: "function", function: opts.tool }],
        tool_choice: { type: "function", function: { name: opts.tool.name } },
      }),
    });
    const latency_ms = Date.now() - started;
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const code =
        res.status === 429 ? "rate_limited"
        : res.status === 402 ? "credits_exhausted"
        : `http_${res.status}`;
      const message =
        res.status === 429 ? "Trop de requêtes IA, réessayez dans un instant."
        : res.status === 402 ? "Crédits IA épuisés — contactez l'administrateur."
        : `Erreur IA (${res.status})`;
      console.error("[ai-gateway] error", res.status, txt.slice(0, 400));
      return { ok: false, error: message, error_code: code, latency_ms, model_id: opts.model };
    }
    const json = await res.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return { ok: false, error: "Réponse IA vide", error_code: "empty_response", latency_ms, model_id: opts.model };
    }
    try {
      const parsed = JSON.parse(toolCall.function.arguments) as T;
      return { ok: true, data: parsed, latency_ms, model_id: opts.model };
    } catch {
      return { ok: false, error: "Réponse IA malformée", error_code: "parse_error", latency_ms, model_id: opts.model };
    }
  } catch (err) {
    const latency_ms = Date.now() - started;
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "Analyse IA trop longue, réessayez." : "Erreur réseau IA",
      error_code: aborted ? "timeout" : "network_error",
      latency_ms,
      model_id: opts.model,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Journalise l'usage IA. Silencieux en cas d'échec de log.
 */
export async function logAiUsage(params: {
  userId: string;
  capability: AiCapability;
  model_id: string;
  latency_ms: number;
  success: boolean;
  error_code?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from("ai_usage_events" as any) as any).insert({
      user_id: params.userId,
      capability: params.capability,
      model_id: params.model_id,
      latency_ms: params.latency_ms,
      success: params.success,
      error_code: params.error_code ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (e) {
    console.warn("[ai-usage] log failed", e);
  }
}

/**
 * Récupère les paramètres IA côté serveur (pour double-gate capacité).
 */
export async function getServerAiSettings(): Promise<{
  ai_enabled: boolean;
  model_overrides: Record<string, string>;
  caps: Record<string, boolean>;
} | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseAdmin.from("ai_settings" as any) as any)
      .select("*")
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const caps: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "boolean") caps[k] = v;
    }
    return {
      ai_enabled: Boolean(data.ai_enabled),
      model_overrides: (data.model_overrides ?? {}) as Record<string, string>,
      caps,
    };
  } catch (e) {
    console.warn("[ai-settings] server fetch failed", e);
    return null;
  }
}
