/**
 * GET /api/public/v1/openapi.json — description OpenAPI 3.0 de l'API (publique, sans clé).
 */
import { createFileRoute } from "@tanstack/react-router";
import { API_CORS } from "@/lib/api/api-response.server";
import { buildOpenApi } from "@/lib/api/openapi-spec";

export const Route = createFileRoute("/api/public/v1/openapi.json")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: API_CORS }),
      GET: async () =>
        new Response(JSON.stringify(buildOpenApi(), null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            ...API_CORS,
          },
        }),
    },
  },
});
