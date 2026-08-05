/**
 * POST /api/public/v1/internal/mission-event
 *
 * Récepteur interne : appelé par la base de données (trigger + pg_net) lors des
 * changements de statut mission et à la création d'une facture. Il relaie
 * l'événement vers les webhooks configurés par le client.
 *
 * Protégé par un secret partagé stocké côté serveur (en-tête `x-ligneo-internal`).
 */
import { createFileRoute } from "@tanstack/react-router";
import { apiError, apiJson, apiOptions, readJsonBody } from "@/lib/api/api-response.server";

export const Route = createFileRoute("/api/public/v1/internal/mission-event")({
  server: {
    handlers: {
      OPTIONS: () => apiOptions(),
      POST: async ({ request }) => {
        const provided = request.headers.get("x-ligneo-internal") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: config } = await supabaseAdmin
          .from("api_internal_config")
          .select("value")
          .eq("key", "event_secret")
          .maybeSingle();

        const expected = config?.value ?? "";
        if (!expected || provided.length !== expected.length || provided !== expected) {
          return apiError(401, "authentication_error", "Appel interne non autorisé.");
        }

        const body = await readJsonBody(request);
        const event = typeof body?.["event"] === "string" ? (body["event"] as string) : "";
        const missionId = typeof body?.["mission_id"] === "string" ? (body["mission_id"] as string) : "";
        const payload = (body?.["payload"] ?? {}) as Record<string, unknown>;
        if (!event || !missionId) return apiError(400, "invalid_request_error", "event et mission_id requis.");

        const { data: mission } = await supabaseAdmin
          .from("missions")
          .select("id, numero, statut, organization_id, options")
          .eq("id", missionId)
          .maybeSingle();
        if (!mission?.organization_id) return apiJson({ ok: true, skipped: true });

        const { dispatchWebhook, WEBHOOK_EVENTS } = await import("@/lib/api/webhooks.server");
        if (!(WEBHOOK_EVENTS as readonly string[]).includes(event)) {
          return apiJson({ ok: true, skipped: true });
        }

        const { toApiStatus } = await import("@/lib/api/api-mappers.server");
        const options = (mission.options ?? {}) as Record<string, unknown>;

        await dispatchWebhook({
          organizationId: mission.organization_id,
          event: event as (typeof WEBHOOK_EVENTS)[number],
          missionId: mission.id,
          overrideUrl: (options["webhook_url"] as string | undefined) ?? null,
          data: {
            mission_id: mission.id,
            reference: mission.numero,
            status: toApiStatus(mission.statut),
            ...payload,
          },
        });

        return apiJson({ ok: true });
      },
    },
  },
});
