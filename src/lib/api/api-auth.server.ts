/**
 * Couche d'authentification de l'API Développeur publique (v1).
 *
 * - Clés `sk_test_…` (sandbox) et `sk_live_…` (production), hashées en SHA-256
 *   en base : la valeur en clair n'existe qu'une seule fois, à la création.
 * - Identifie l'organisation cliente et applique un quota de débit
 *   (100 req/min par clé par défaut).
 *
 * Server-only : ne jamais importer depuis un composant.
 */
import { createHash, randomBytes } from "node:crypto";

export const API_RATE_LIMIT_PER_MIN = 100;

export interface ApiCaller {
  keyId: string;
  organizationId: string;
  environment: "test" | "live";
  sandbox: boolean;
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Génère une clé API en clair (à ne renvoyer qu'une seule fois). */
export function generateApiKey(environment: "test" | "live"): string {
  return `sk_${environment}_${randomBytes(24).toString("base64url")}`;
}

export interface AuthFailure {
  status: number;
  body: { error: { type: string; message: string } };
  headers?: Record<string, string>;
}

export async function authenticateApiRequest(
  request: Request,
): Promise<{ caller: ApiCaller } | { failure: AuthFailure }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return {
      failure: {
        status: 401,
        body: { error: { type: "authentication_error", message: "Clé API manquante. Ajoutez l'en-tête Authorization: Bearer sk_live_…" } },
      },
    };
  }
  if (!/^sk_(test|live)_[A-Za-z0-9_-]{20,}$/.test(token)) {
    return {
      failure: {
        status: 401,
        body: { error: { type: "authentication_error", message: "Format de clé API invalide." } },
      },
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: key } = await supabaseAdmin
    .from("api_keys")
    .select("id, organization_id, environment, revoked_at")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();

  if (!key) {
    return {
      failure: {
        status: 401,
        body: { error: { type: "authentication_error", message: "Clé API inconnue." } },
      },
    };
  }
  if (key.revoked_at) {
    return {
      failure: {
        status: 401,
        body: { error: { type: "authentication_error", message: "Cette clé API a été révoquée." } },
      },
    };
  }

  // Quota de débit : fenêtre glissante d'une minute
  const window = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const { data: count } = await supabaseAdmin.rpc("api_rate_bump", {
    _api_key_id: key.id,
    _window: window,
  });
  if (typeof count === "number" && count > API_RATE_LIMIT_PER_MIN) {
    const retryAfter = Math.max(1, 60 - Math.floor((Date.now() % 60000) / 1000));
    return {
      failure: {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
        body: {
          error: {
            type: "rate_limit_error",
            message: `Quota dépassé (${API_RATE_LIMIT_PER_MIN} requêtes/minute). Réessayez dans ${retryAfter}s.`,
          },
        },
      },
    };
  }

  void supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .then(() => undefined);

  const environment = key.environment as "test" | "live";
  return {
    caller: {
      keyId: key.id,
      organizationId: key.organization_id,
      environment,
      sandbox: environment === "test",
    },
  };
}
