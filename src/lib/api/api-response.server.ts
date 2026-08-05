/**
 * Helpers de réponse HTTP pour l'API Développeur publique (v1).
 * Server-only.
 */
export const API_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function apiJson(body: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...API_CORS, ...(extra ?? {}) },
  });
}

export function apiError(
  status: number,
  type: string,
  message: string,
  extra?: Record<string, string>,
): Response {
  return apiJson({ error: { type, message } }, status, extra);
}

export function apiOptions(): Response {
  return new Response(null, { status: 204, headers: API_CORS });
}

/** Authentifie la requête et renvoie soit l'appelant, soit une Response d'erreur prête à renvoyer. */
export async function requireApiCaller(request: Request) {
  const { authenticateApiRequest } = await import("./api-auth.server");
  const result = await authenticateApiRequest(request);
  if ("failure" in result) {
    return { response: apiJson(result.failure.body, result.failure.status, result.failure.headers) };
  }
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
