/** Compteur d'usage côté serveur (recherches de plaques) + quota restant renvoyé par RapidAPI. */
export async function logServerUsage(service: "plaque_siv" | "plaque_ocr", res?: Response | null) {
  try {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    await db.from("api_usage").insert({ service, units: 1 });
    if (res) {
      const remaining = Number(res.headers.get("x-ratelimit-requests-remaining") ?? res.headers.get("x-ratelimit-remaining"));
      const limit = Number(res.headers.get("x-ratelimit-requests-limit") ?? res.headers.get("x-ratelimit-limit"));
      if (Number.isFinite(remaining) && res.headers.get("x-ratelimit-requests-remaining") !== null) {
        await db.from("api_quota").upsert({ service, remaining, limit_total: Number.isFinite(limit) ? limit : null, updated_at: new Date().toISOString() });
      }
    }
  } catch { /* jamais bloquant */ }
}
