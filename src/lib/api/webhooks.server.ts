/**
 * Envoi des webhooks API vers les serveurs des clients intégrateurs.
 *
 * - Signature HMAC SHA-256 dans l'en-tête `X-Ligneo-Signature`
 *   (format `t=<timestamp>,v1=<hex>` sur la charge `"<timestamp>.<body>"`).
 * - 3 tentatives maximum avec backoff exponentiel (1s, 4s).
 * - Chaque tentative est journalisée dans `api_webhook_deliveries`.
 *
 * Server-only.
 */
import { createHmac, randomBytes } from "node:crypto";

export const WEBHOOK_EVENTS = [
  "mission.assigned",
  "mission.started",
  "mission.delivered",
  "mission.cancelled",
  "invoice.available",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | "webhook.test";

export interface DeliveryResult {
  url: string;
  success: boolean;
  statusCode: number | null;
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function signWebhookPayload(secret: string, body: string, timestamp: number): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DispatchOptions {
  organizationId: string;
  event: WebhookEvent;
  data: Record<string, unknown>;
  missionId?: string | null;
  environment?: "test" | "live";
  /** URL spécifique fournie lors de la création d'une mission. */
  overrideUrl?: string | null;
  /** Envoi ciblé (événement de test) : ignore le filtrage par événements. */
  onlyEndpointId?: string;
}

/** Envoie un événement à tous les endpoints actifs de l'organisation (3 tentatives). */
export async function dispatchWebhook(opts: DispatchOptions): Promise<DeliveryResult[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const environment = opts.environment ?? "live";

  const { data: endpoints } = await supabaseAdmin
    .from("api_webhook_endpoints")
    .select("id, url, secret, events, active, environment")
    .eq("organization_id", opts.organizationId)
    .eq("environment", environment)
    .eq("active", true);

  const targets = (endpoints ?? [])
    .filter((e) =>
      opts.onlyEndpointId ? e.id === opts.onlyEndpointId : (e.events ?? []).includes(opts.event),
    )
    .map((e) => ({ id: e.id as string | null, url: e.url as string, secret: e.secret as string }));

  if (opts.overrideUrl && !targets.some((t) => t.url === opts.overrideUrl)) {
    const fallbackSecret = targets[0]?.secret ?? generateWebhookSecret();
    targets.push({ id: null, url: opts.overrideUrl, secret: fallbackSecret });
  }
  if (targets.length === 0) return [];

  const body = JSON.stringify({
    id: `evt_${randomBytes(8).toString("hex")}`,
    type: opts.event,
    created_at: new Date().toISOString(),
    livemode: environment === "live",
    data: opts.data,
  });

  return await Promise.all(
    targets.map(async (target): Promise<DeliveryResult> => {
      let lastStatus: number | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const timestamp = Math.floor(Date.now() / 1000);
        let statusCode: number | null = null;
        let errorMsg: string | null = null;
        try {
          const res = await fetch(target.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Ligneo-Signature": signWebhookPayload(target.secret, body, timestamp),
              "X-Ligneo-Event": opts.event,
            },
            body,
          });
          statusCode = res.status;
          lastStatus = res.status;
          if (!res.ok) errorMsg = `HTTP ${res.status}`;
        } catch (e) {
          errorMsg = e instanceof Error ? e.message : "network error";
        }

        const success = statusCode === 200 || statusCode === 201 || statusCode === 204;
        await supabaseAdmin.from("api_webhook_deliveries").insert({
          organization_id: opts.organizationId,
          endpoint_id: target.id,
          event: opts.event,
          target_url: target.url,
          mission_id: opts.missionId ?? null,
          payload: JSON.parse(body),
          attempt,
          status_code: statusCode,
          success,
          error: errorMsg,
        });

        if (success) return { url: target.url, success: true, statusCode };
        if (attempt < 3) await sleep(attempt === 1 ? 1000 : 4000); // backoff exponentiel
      }
      return { url: target.url, success: false, statusCode: lastStatus };
    }),
  );
}

/** Rejoue une livraison passée (charge utile identique, une seule tentative, journalisée). */
export async function redeliverWebhook(organizationId: string, deliveryId: string): Promise<DeliveryResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: d } = await supabaseAdmin
    .from("api_webhook_deliveries")
    .select("id, endpoint_id, event, target_url, mission_id, payload")
    .eq("id", deliveryId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!d) throw new Error("Livraison introuvable.");
  let secret: string | null = null;
  if (d.endpoint_id) {
    const { data: ep } = await supabaseAdmin
      .from("api_webhook_endpoints")
      .select("secret")
      .eq("id", d.endpoint_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    secret = (ep?.secret as string | undefined) ?? null;
  }
  if (!secret) throw new Error("Endpoint supprimé : rejeu impossible.");
  const body = JSON.stringify(d.payload ?? {});
  const timestamp = Math.floor(Date.now() / 1000);
  let statusCode: number | null = null;
  let errorMsg: string | null = null;
  try {
    const res = await fetch(d.target_url as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ligneo-Signature": signWebhookPayload(secret, body, timestamp),
        "X-Ligneo-Event": d.event as string,
        "X-Ligneo-Replay": "true",
      },
      body,
    });
    statusCode = res.status;
    if (!res.ok) errorMsg = `HTTP ${res.status}`;
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "network error";
  }
  const success = statusCode === 200 || statusCode === 201 || statusCode === 204;
  await supabaseAdmin.from("api_webhook_deliveries").insert({
    organization_id: organizationId,
    endpoint_id: d.endpoint_id,
    event: d.event,
    target_url: d.target_url,
    mission_id: d.mission_id,
    payload: d.payload,
    attempt: 1,
    status_code: statusCode,
    success,
    error: errorMsg ? `rejeu · ${errorMsg}` : "rejeu manuel",
  });
  return { url: d.target_url as string, success, statusCode };
}
