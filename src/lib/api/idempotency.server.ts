/**
 * Clés de non-doublon (en-tête `Idempotency-Key`) pour les créations de devis et de missions.
 *
 * - Même clé + mêmes paramètres : la première réponse est renvoyée à l'identique
 *   (en-tête `Idempotent-Replayed: true`), rien n'est créé une seconde fois.
 * - Même clé + paramètres différents : erreur 422.
 * - Requête identique encore en cours : erreur 409.
 * - Les clés sont conservées 24 h.
 *
 * Server-only.
 */
import { createHash } from "node:crypto";
import type { ApiCaller } from "./api-auth.server";
import { apiError, apiJson, currentApiContext } from "./api-response.server";

export async function idempotencyBegin(
  caller: ApiCaller,
  request: Request,
  body: Record<string, unknown> | null,
): Promise<{ response?: Response }> {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) return {};
  if (key.length > 200) {
    return { response: apiError(400, "invalid_request_error", "Idempotency-Key trop longue (200 caractères maximum).") };
  }
  const hash = createHash("sha256")
    .update(`${request.method}|${new URL(request.url).pathname}|${JSON.stringify(body ?? {})}`)
    .digest("hex");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: existing } = await supabaseAdmin
    .from("api_idempotency_keys")
    .select("request_hash, status_code, response_body, created_at")
    .eq("organization_id", caller.organizationId)
    .eq("idem_key", key)
    .maybeSingle();

  if (existing && existing.created_at >= since) {
    if (existing.request_hash !== hash) {
      return {
        response: apiError(
          422,
          "idempotency_error",
          "Cette Idempotency-Key a déjà été utilisée avec des paramètres différents.",
        ),
      };
    }
    if (existing.status_code == null) {
      return {
        response: apiError(409, "idempotency_error", "Une requête identique est encore en cours de traitement.", {
          "Retry-After": "2",
        }),
      };
    }
    return {
      response: apiJson(existing.response_body, existing.status_code, { "Idempotent-Replayed": "true" }),
    };
  }
  if (existing) {
    await supabaseAdmin
      .from("api_idempotency_keys")
      .delete()
      .eq("organization_id", caller.organizationId)
      .eq("idem_key", key);
  }

  const { error } = await supabaseAdmin.from("api_idempotency_keys").insert({
    organization_id: caller.organizationId,
    idem_key: key,
    request_hash: hash,
  });
  if (error) {
    return {
      response: apiError(409, "idempotency_error", "Une requête identique est encore en cours de traitement.", {
        "Retry-After": "2",
      }),
    };
  }
  const ctx = currentApiContext();
  if (ctx) ctx.idempotency = { organizationId: caller.organizationId, key };
  return {};
}

/** Enregistre la réponse (ou libère la clé si le serveur a échoué, pour permettre de réessayer). */
export async function idempotencyFinish(
  ref: { organizationId: string; key: string },
  status: number,
  body: unknown,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (status >= 500) {
    await supabaseAdmin
      .from("api_idempotency_keys")
      .delete()
      .eq("organization_id", ref.organizationId)
      .eq("idem_key", ref.key);
    return;
  }
  await supabaseAdmin
    .from("api_idempotency_keys")
    .update({ status_code: status, response_body: body as never })
    .eq("organization_id", ref.organizationId)
    .eq("idem_key", ref.key);
}
