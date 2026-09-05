// Client serveur pour l'API Merchant Revolut Business.
// La clé secrète n'est lue que dans les handlers serveur (jamais côté client).

export type RevolutEnv = "sandbox" | "production";

const API_VERSION = "2024-09-01";

export function revolutBaseUrl(env: RevolutEnv): string {
  return env === "sandbox"
    ? "https://sandbox-merchant.revolut.com/api"
    : "https://merchant.revolut.com/api";
}

export function revolutSecretKey(env: RevolutEnv): string {
  const key =
    env === "sandbox"
      ? process.env["REVOLUT_SECRET_KEY_SANDBOX"]
      : process.env["REVOLUT_SECRET_KEY"];
  if (!key) {
    throw new Error(
      env === "sandbox"
        ? "Mode test indisponible : la clé secrète Revolut sandbox n'est pas configurée."
        : "La clé secrète Revolut n'est pas configurée.",
    );
  }
  if (!key.startsWith("sk_")) {
    throw new Error(
      `Clé Revolut ${env === "sandbox" ? "sandbox " : ""}invalide : il faut la clé secrète (commence par « sk_ »), pas la clé publique.`,
    );
  }
  return key;
}


async function revolutFetch(
  env: RevolutEnv,
  path: string,
  init?: RequestInit,
): Promise<any> {
  const res = await fetch(`${revolutBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${revolutSecretKey(env)}`,
      "Revolut-Api-Version": API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* réponse non JSON */
  }
  if (!res.ok) {
    const message =
      json?.message || json?.error || `Revolut API error (${res.status})`;
    throw new Error(String(message));
  }
  return json;
}

export type RevolutOrder = {
  id: string;
  state: string;
  checkout_url?: string;
  token?: string;
};

/** Crée une order Revolut et renvoie l'identifiant + le lien de paiement. */
export async function createRevolutOrder(params: {
  env: RevolutEnv;
  amountMinor: number;
  currency: string;
  description?: string | null;
  reference?: string | null;
  email?: string | null;
}): Promise<RevolutOrder> {
  const body: Record<string, unknown> = {
    amount: params.amountMinor,
    currency: params.currency,
  };
  if (params.description) body["description"] = params.description;
  if (params.reference) body["merchant_order_data"] = { reference: params.reference };
  if (params.email) body["customer"] = { email: params.email };

  const order = await revolutFetch(params.env, "/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return order as RevolutOrder;
}

/** Récupère l'état courant d'une order Revolut. */
export async function retrieveRevolutOrder(
  env: RevolutEnv,
  orderId: string,
): Promise<RevolutOrder> {
  return (await revolutFetch(env, `/orders/${encodeURIComponent(orderId)}`)) as RevolutOrder;
}

/** Statut interne correspondant à un état d'order Revolut. */
export function mapRevolutState(state?: string | null): string {
  switch ((state || "").toUpperCase()) {
    case "COMPLETED":
      return "paid";
    case "PENDING":
    case "PROCESSING":
    case "AUTHORISED":
      return "processing";
    case "CANCELLED":
      return "cancelled";
    case "FAILED":
      return "failed";
    default:
      return "pending";
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vérifie la signature d'un webhook Revolut.
 * payload signé : "v1.<timestamp>.<rawBody>" en HMAC-SHA256 avec le signing secret.
 */
export async function verifyRevolutSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  secret: string;
}): Promise<boolean> {
  const { rawBody, signatureHeader, timestampHeader, secret } = params;
  if (!signatureHeader || !timestampHeader || !secret) return false;

  // Rejette les requêtes trop anciennes (protection rejeu) : 5 minutes.
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`v1.${timestampHeader}.${rawBody}`),
  );
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatureHeader
    .split(",")
    .map((s) => s.trim())
    .some((candidate) => {
      const value = candidate.startsWith("v1=") ? candidate.slice(3) : candidate;
      return timingSafeEqual(value.toLowerCase(), expected);
    });
}

/** Annule une order Revolut (impossible si déjà payée). */
export async function cancelRevolutOrder(
  env: RevolutEnv,
  orderId: string,
): Promise<RevolutOrder> {
  return (await revolutFetch(env, `/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
  })) as RevolutOrder;
}
