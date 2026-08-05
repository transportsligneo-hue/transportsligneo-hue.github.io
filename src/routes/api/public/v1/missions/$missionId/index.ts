/**
 * GET    /api/public/v1/missions/{id} — détail d'une mission.
 * DELETE /api/public/v1/missions/{id} — annulation (si la mission n'a pas démarré).
 */
import { createFileRoute } from "@tanstack/react-router";
import { apiError, apiJson, apiOptions, requireApiCaller } from "@/lib/api/api-response.server";

const MISSION_COLS =
  "id, numero, statut, ville_depart, ville_arrivee, immatriculation, marque, modele, prix_total, date_prise_en_charge, devis_id, created_at, options, organization_id";

export const Route = createFileRoute("/api/public/v1/missions/$missionId/")({
  server: {
    handlers: {
      OPTIONS: () => apiOptions(),

      GET: async ({ request, params }) => {
        const auth = await requireApiCaller(request);
        if ("response" in auth) return auth.response;

        if (auth.caller.sandbox) {
          const { sandboxDelay, sandboxMission } = await import("@/lib/api/sandbox.server");
          await sandboxDelay();
          return apiJson(sandboxMission(params.missionId));
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { missionToApi } = await import("@/lib/api/api-mappers.server");
        const { data } = await supabaseAdmin
          .from("missions")
          .select(MISSION_COLS)
          .eq("id", params.missionId)
          .eq("organization_id", auth.caller.organizationId)
          .maybeSingle();

        if (!data) return apiError(404, "not_found", "Mission introuvable.");
        return apiJson(missionToApi(data));
      },

      DELETE: async ({ request, params }) => {
        const auth = await requireApiCaller(request);
        if ("response" in auth) return auth.response;

        if (auth.caller.sandbox) {
          const { sandboxDelay } = await import("@/lib/api/sandbox.server");
          await sandboxDelay();
          return apiJson({ id: params.missionId, object: "mission", livemode: false, status: "cancelled" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { missionToApi } = await import("@/lib/api/api-mappers.server");
        const { dispatchWebhook } = await import("@/lib/api/webhooks.server");

        const { data: mission } = await supabaseAdmin
          .from("missions")
          .select(MISSION_COLS)
          .eq("id", params.missionId)
          .eq("organization_id", auth.caller.organizationId)
          .maybeSingle();

        if (!mission) return apiError(404, "not_found", "Mission introuvable.");
        if (["en_cours", "termine", "validee"].includes(mission.statut ?? "")) {
          return apiError(409, "invalid_request_error", "Mission déjà démarrée : annulation impossible via l'API.");
        }

        const { data: updated } = await supabaseAdmin
          .from("missions")
          .update({ statut: "annule" })
          .eq("id", mission.id)
          .select(MISSION_COLS)
          .single();

        const options = (mission.options ?? {}) as Record<string, unknown>;
        void dispatchWebhook({
          organizationId: auth.caller.organizationId,
          event: "mission.cancelled",
          missionId: mission.id,
          data: { mission_id: mission.id, reference: mission.numero, status: "cancelled" },
          overrideUrl: (options["webhook_url"] as string | undefined) ?? null,
        });

        return apiJson(missionToApi(updated ?? { ...mission, statut: "annule" }));
      },
    },
  },
});
