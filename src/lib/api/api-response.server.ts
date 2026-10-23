/**
 * Helpers de réponse HTTP pour l'API Développeur publique (v1).
 * Server-only.
 *
 * Chaque requête authentifiée reçoit un identifiant (`X-Request-Id`), les en-têtes de quota
 * (`X-RateLimit-*`) et est inscrite au journal (`api_request_logs`) au moment où la réponse
 * est construite. Si l'appel porte une `Idempotency-Key`, la réponse est mémorisée pour
 * être rejouée à l'identique en cas de nouvel envoi.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import type { ApiCaller } from "./api-auth.server";

export const API_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
  "Access-Control-Expose-Headers":
    "X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After, Idempotent-Replayed",
  "Access-Control-Max-Age": "86400",
};

export interface ApiRequestContext {
  requestId: string;
  startedAt: number;
  method: string;
  path: string;
  caller?: ApiCaller;
  /** Clé de non-doublon en attente d'enregistrement de la réponse. */
  idempotency?: { organizationId: string; key: string };
  logged?: boolean;
}

const store = new AsyncLocalStorage<ApiRequestContext>();

export function currentApiContext(): ApiRequestContext | undefined {
  return store.getStore();
}

function sideEffects(status: number, body: unknown, ctx: ApiRequestContext | undefined) {
  if (!ctx || ctx.logged) return;
  ctx.logged = true;
  const caller = ctx.caller;
  if (!caller) return;
  const errorType =
    body && typeof body === "object" && "error" in (body as Record<string, unknown>)
      ? String(((body as { error?: { type?: string } }).error ?? {}).type ?? "")
      : null;
  void (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("api_request_logs").insert({
        api_key_id: caller.keyId,
        organization_id: caller.organizationId,
        environment: caller.environment,
        method: ctx.method,
        path: ctx.path,
        status_code: status,
        duration_ms: Date.now() - ctx.startedAt,
        request_id: ctx.requestId,
        idempotency_key: ctx.idempotency?.key ?? null,
        error_type: errorType || null,
      });
      if (ctx.idempotency) {
        const { idempotencyFinish } = await import("./idempotency.server");
        await idempotencyFinish(ctx.idempotency, status, body);
      }
    } catch {
      /* le journal ne doit jamais casser l'API */
    }
  })();
}

export function apiJson(body: unknown, status = 200, extra?: Record<string, string>): Response {
  const ctx = store.getStore();
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...API_CORS,
  };
  if (ctx) {
    headers["X-Request-Id"] = ctx.requestId;
    const rl = ctx.caller?.rateLimit;
    if (rl) {
      headers["X-RateLimit-Limit"] = String(rl.limit);
      headers["X-RateLimit-Remaining"] = String(rl.remaining);
      headers["X-RateLimit-Reset"] = String(rl.resetInSeconds);
    }
  }
  sideEffects(status, body, ctx);
  return new Response(JSON.stringify(body), { status, headers: { ...headers, ...(extra ?? {}) } });
}

export function apiError(
  status: number,
  type: string,
  message: string,
  extra?: Record<string, string>,
): Response {
  const ctx = store.getStore();
  return apiJson({ error: { type, message, request_id: ctx?.requestId ?? null } }, status, extra);
}

export function apiOptions(): Response {
  return new Response(null, { status: 204, headers: API_CORS });
}

/** Authentifie la requête et renvoie soit l'appelant, soit une Response d'erreur prête à renvoyer. */
export async function requireApiCaller(request: Request) {
  // Doit être appelé avant le premier `await` : le contexte suit alors toute la requête.
  const url = new URL(request.url);
  const ctx: ApiRequestContext = {
    requestId: `req_${randomBytes(8).toString("hex")}`,
    startedAt: Date.now(),
    method: request.method,
    path: url.pathname.replace(/^\/api\/public/, ""),
  };
  store.enterWith(ctx);

  const { authenticateApiRequest } = await import("./api-auth.server");
  const result = await authenticateApiRequest(request);
  if ("failure" in result) {
    return { response: apiJson(result.failure.body, result.failure.status, result.failure.headers) };
  }
  ctx.caller = result.caller;
  return { caller: result.caller };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
