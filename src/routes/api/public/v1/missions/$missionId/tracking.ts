/**
 * GET /api/public/v1/missions/{id}/tracking — position GPS et statut temps réel.
 */
import { createFileRoute } from "@tanstack/react-router";
import { apiError, apiJson, apiOptions, requireApiCaller } from "@/lib/api/api-response.server";

export const Route = createFileRoute("/api/public/v1/missions/$missionId/tracking")({
  server: {
    handlers: {
      OPTIONS: () => apiOptions(),
      GET: async ({ request, params }) => {
        const auth = await requireApiCaller(request);
        if ("response" in auth) return auth.response;

        if (auth.caller.sandbox) {
          const { sandboxDelay, sandboxTracking } = await import("@/lib/api/sandbox.server");
          await sandboxDelay();
          return apiJson(sandboxTracking(params.missionId));
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { toApiStatus } = await import("@/lib/api/api-mappers.server");

        const { data: mission } = await supabaseAdmin
          .from("missions")
          .select("id, statut")
          .eq("id", params.missionId)
          .eq("organization_id", auth.caller.organizationId)
          .maybeSingle();
        if (!mission) return apiError(404, "not_found", "Mission introuvable.");

        const { data: trajets } = await supabaseAdmin
          .from("trajets")
          .select("id")
          .eq("mission_id", mission.id);
        const trajetIds = (trajets ?? []).map((t) => t.id);

        let position: { lat: number; lng: number; recorded_at: string } | null = null;
        let driverName: string | null = null;
        let attributionStatus: string | null = null;

        if (trajetIds.length > 0) {
          const { data: attribution } = await supabaseAdmin
            .from("attributions")
            .select("id, statut, etape_courante, convoyeur_id")
            .in("trajet_id", trajetIds)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (attribution) {
            attributionStatus = attribution.etape_courante ?? attribution.statut;
            const { data: loc } = await supabaseAdmin
              .from("mission_locations")
              .select("latitude, longitude, recorded_at")
              .eq("attribution_id", attribution.id)
              .order("recorded_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (loc) position = { lat: loc.latitude, lng: loc.longitude, recorded_at: loc.recorded_at };

            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("prenom, nom")
              .eq("id", attribution.convoyeur_id)
              .maybeSingle();
            if (profile) driverName = `${profile.prenom ?? ""} ${(profile.nom ?? "").slice(0, 1)}.`.trim();
          }
        }

        return apiJson({
          mission_id: mission.id,
          object: "tracking",
          livemode: true,
          status: toApiStatus(mission.statut),
          step: attributionStatus,
          driver: driverName ? { name: driverName } : null,
          current_location: position,
          updated_at: position?.recorded_at ?? null,
        });
      },
    },
  },
});
