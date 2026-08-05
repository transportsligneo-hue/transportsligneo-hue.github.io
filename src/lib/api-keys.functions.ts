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
        .select("id, name, environment, key_prefix, key_last4, created_at, last_used_at, revoked_at")
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("api_webhook_endpoints")
        .select("id, url, environment, events, active, created_at")
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("api_webhook_deliveries")
        .select("id, event, target_url, attempt, status_code, success, error, created_at")
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    return { keys: keys ?? [], webhooks: hooks ?? [], deliveries: deliveries ?? [] };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; name: string; environment: "test" | "live" }) => input)
  .handler(async ({ data, context }) => {
    const { assertOrgAccess, keyPreview } = await import("@/lib/api-keys.server");
    const { generateApiKey, hashApiKey } = await import("@/lib/api/api-auth.server");
    await assertOrgAccess(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
