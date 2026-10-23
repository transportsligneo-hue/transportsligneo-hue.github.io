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

/** IP de l'appelant (première adresse de X-Forwarded-For). */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0] : request.headers.get("x-real-ip") ?? "").trim();
}

function ipv4ToInt(ip: string): number | null {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

/** Vrai si l'IP correspond à une entrée de la liste (adresse exacte ou plage IPv4 type 203.0.113.0/24). */
export function ipAllowed(ip: string, list: string[]): boolean {
  if (!list.length) return true;
  for (const entry of list) {
    if (entry === ip) return true;
    const [base, bits] = entry.split("/");
    if (bits !== undefined) {
      const a = ipv4ToInt(ip), b = ipv4ToInt(base), n = Number(bits);
      if (a !== null && b !== null && n >= 0 && n <= 32) {
        const mask = n === 0 ? 0 : (0xffffffff << (32 - n)) >>> 0;
        if ((a & mask) === (b & mask)) return true;
      }
    }
  }
  return false;
}

export interface ApiCaller {
  keyId: string;
  organizationId: string;
  environment: "test" | "live";
  sandbox: boolean;
  /** Quota de débit au moment de la requête (en-têtes X-RateLimit-*). */
  rateLimit?: { limit: number; remaining: number; resetInSeconds: number };
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
    .select("id, organization_id, environment, revoked_at, scope, allowed_ips, expires_at")
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

  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    return {
      failure: {
        status: 401,
        body: { error: { type: "authentication_error", message: "Cette clé API a expiré. Générez-en une nouvelle dans votre espace pro." } },
      },
    };
  }
  const ips = (key.allowed_ips as string[] | null) ?? [];
  if (ips.length && !ipAllowed(clientIp(request), ips)) {
    return {
      failure: {
        status: 403,
        body: { error: { type: "permission_error", message: "Adresse IP non autorisée pour cette clé." } },
      },
    };
  }
  const isRead = request.method === "GET" || request.method === "OPTIONS" || new URL(request.url).pathname.endsWith("/quotes/estimate");
  if (key.scope === "read" && !isRead) {
    return {
      failure: {
        status: 403,
        body: { error: { type: "permission_error", message: "Cette clé est en lecture seule : création, modification et annulation sont refusées." } },
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
  const used = typeof count === "number" ? count : 1;
  return {
    caller: {
      rateLimit: {
        limit: API_RATE_LIMIT_PER_MIN,
        remaining: Math.max(0, API_RATE_LIMIT_PER_MIN - used),
        resetInSeconds: Math.max(1, 60 - Math.floor((Date.now() % 60000) / 1000)),
      },
      keyId: key.id,
      organizationId: key.organization_id,
      environment,
      sandbox: environment === "test",
    },
  };
}
