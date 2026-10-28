/**
 * Server functions de l'espace B2B « API & Intégrations ».
 * Fichier volontairement mince : imports + déclarations createServerFn uniquement.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertOrgAccess } = await import("@/lib/api-keys.server");
    await assertOrgAccess(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: keys }, { data: hooks }, { data: deliveries }] = await Promise.all([
      supabaseAdmin
        .from("api_keys")
        .select("id, name, environment, key_prefix, key_last4, created_at, last_used_at, revoked_at, scope, allowed_ips, expires_at")
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("api_webhook_endpoints")
        .select("id, url, environment, events, active, created_at")
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("api_webhook_deliveries")
        .select("id, event, target_url, attempt, status_code, success, error, created_at, payload")
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return { keys: keys ?? [], webhooks: hooks ?? [], deliveries: deliveries ?? [] };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; name: string; environment: "test" | "live"; scope?: "read" | "write"; allowedIps?: string[]; expiresInDays?: number | null }) => input)
  .handler(async ({ data, context }) => {
    ;(await import("@/lib/demo-block.server")).assertNotDemo((context as { claims?: unknown }).claims)
    const { assertOrgAccess, keyPreview } = await import("@/lib/api-keys.server");
    const { generateApiKey, hashApiKey } = await import("@/lib/api/api-auth.server");
    await assertOrgAccess(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ips = (data.allowedIps ?? []).map((x) => x.trim()).filter(Boolean);
    if (ips.length > 20 || ips.some((x) => !/^[0-9a-fA-F:.]+(\/\d{1,3})?$/.test(x))) throw new Error("Adresses IP invalides (ex. 203.0.113.4 ou 203.0.113.0/24).");
    const days = data.expiresInDays && data.expiresInDays > 0 ? Math.min(data.expiresInDays, 3650) : null;
    const raw = generateApiKey(data.environment);
    const preview = keyPreview(raw);
    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        organization_id: data.organizationId,
        created_by: context.userId,
        name: data.name.trim() || (data.environment === "live" ? "Clé production" : "Clé sandbox"),
        environment: data.environment,
        key_hash: hashApiKey(raw),
        key_prefix: preview.key_prefix,
        key_last4: preview.key_last4,
        scope: data.scope === "read" ? "read" : "write",
        allowed_ips: ips,
        expires_at: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
      })
      .select("id, name, environment, key_prefix, key_last4, created_at")
      .single();

    if (error || !row) throw new Error("Impossible de générer la clé API.");
    // La clé en clair n'est renvoyée qu'une seule fois.
    return { key: row, secret: raw };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; keyId: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertOrgAccess } = await import("@/lib/api-keys.server");
    await assertOrgAccess(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.keyId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error("Révocation impossible.");
    return { ok: true };
  });

export const saveWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { organizationId: string; url: string; environment: "test" | "live"; events: string[] }) => input,
  )
  .handler(async ({ data, context }) => {
    const { assertOrgAccess } = await import("@/lib/api-keys.server");
    const { generateWebhookSecret, WEBHOOK_EVENTS } = await import("@/lib/api/webhooks.server");
    await assertOrgAccess(context.supabase, context.userId, data.organizationId);

    if (!/^https:\/\/.+/.test(data.url.trim())) throw new Error("L'URL du webhook doit être en HTTPS.");
    const events = data.events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
    if (events.length === 0) throw new Error("Sélectionnez au moins un événement.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const secret = generateWebhookSecret();
    const { data: row, error } = await supabaseAdmin
      .from("api_webhook_endpoints")
      .insert({
        organization_id: data.organizationId,
        url: data.url.trim(),
        environment: data.environment,
        events,
        secret,
        active: true,
      })
      .select("id, url, environment, events, active, created_at")
      .single();
    if (error || !row) throw new Error("Impossible d'enregistrer le webhook.");
    return { endpoint: row, secret };
  });

export const deleteWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; endpointId: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertOrgAccess } = await import("@/lib/api-keys.server");
    await assertOrgAccess(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("api_webhook_endpoints")
      .delete()
      .eq("id", data.endpointId)
      .eq("organization_id", data.organizationId);
    return { ok: true };
  });

/** Statistiques d'usage et journal des requêtes (48 dernières heures). */
export const getApiUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; environment: "test" | "live" }) => input)
  .handler(async ({ data, context }) => {
    const { assertOrgAccess } = await import("@/lib/api-keys.server");
    await assertOrgAccess(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const since = new Date(now - 48 * 3600 * 1000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("api_request_logs")
      .select("id, method, path, status_code, duration_ms, request_id, idempotency_key, error_type, created_at")
      .eq("organization_id", data.organizationId)
      .eq("environment", data.environment)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    const logs = rows ?? [];

    const cut24 = now - 24 * 3600 * 1000;
    const last24 = logs.filter((r) => new Date(r.created_at).getTime() >= cut24);
    const prev24 = logs.length - last24.length;
    const ok = last24.filter((r) => r.status_code < 400).length;
    const lat = last24.map((r) => r.duration_ms ?? 0).filter((n) => n > 0);
    const hourly = Array.from({ length: 24 }, () => 0);
    for (const r of last24) {
      const h = Math.min(23, Math.floor((now - new Date(r.created_at).getTime()) / 3600000));
      hourly[23 - h] += 1;
    }

    const { data: dl } = await supabaseAdmin
      .from("api_webhook_deliveries")
      .select("success")
      .eq("organization_id", data.organizationId)
      .gte("created_at", new Date(cut24).toISOString())
      .limit(2000);
    const hooksTotal = (dl ?? []).length;
    const hooksOk = (dl ?? []).filter((d) => d.success).length;

    return {
      summary: {
        requests24h: last24.length,
        requestsPrev24h: prev24,
        successRate: last24.length ? Math.round((ok / last24.length) * 1000) / 10 : null,
        avgLatencyMs: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null,
        webhooksTotal: hooksTotal,
        webhooksOk: hooksOk,
      },
      hourly,
      logs: logs.slice(0, 80),
    };
  });

/** Rejoue une livraison de webhook passée. */
export const replayWebhookDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; deliveryId: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertOrgAccess } = await import("@/lib/api-keys.server");
    await assertOrgAccess(context.supabase, context.userId, data.organizationId);
    const { redeliverWebhook } = await import("@/lib/api/webhooks.server");
    return await redeliverWebhook(data.organizationId, data.deliveryId);
  });

/** Envoie un événement de test signé vers un endpoint. */
export const sendTestWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; endpointId: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertOrgAccess } = await import("@/lib/api-keys.server");
    await assertOrgAccess(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ep } = await supabaseAdmin
      .from("api_webhook_endpoints")
      .select("id, environment")
      .eq("id", data.endpointId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!ep) throw new Error("Endpoint introuvable.");
    const { dispatchWebhook } = await import("@/lib/api/webhooks.server");
    const results = await dispatchWebhook({
      organizationId: data.organizationId,
      event: "webhook.test",
      data: { message: "Événement de test envoyé depuis votre espace Transports Ligneo." },
      environment: ep.environment as "test" | "live",
      onlyEndpointId: ep.id as string,
    });
    return results[0] ?? { url: "", success: false, statusCode: null };
  });
