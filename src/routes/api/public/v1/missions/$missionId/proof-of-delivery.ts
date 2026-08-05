/**
 * GET /api/public/v1/missions/{id}/proof-of-delivery — bon de livraison signé (EDL) en PDF.
 */
import { createFileRoute } from "@tanstack/react-router";
import { apiError, apiJson, apiOptions, requireApiCaller } from "@/lib/api/api-response.server";

export const Route = createFileRoute("/api/public/v1/missions/$missionId/proof-of-delivery")({
  server: {
    handlers: {
      OPTIONS: () => apiOptions(),
      GET: async ({ request, params }) => {
        const auth = await requireApiCaller(request);
        if ("response" in auth) return auth.response;

        if (auth.caller.sandbox) {
          const { sandboxDelay } = await import("@/lib/api/sandbox.server");
          await sandboxDelay();
          return apiJson({
            mission_id: params.missionId,
            object: "document",
            livemode: false,
            type: "proof_of_delivery",
            url: "https://api-sandbox.transportsligneo.fr/v1/documents/pod_test_sample.pdf",
            expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: mission } = await supabaseAdmin
          .from("missions")
          .select("id")
          .eq("id", params.missionId)
          .eq("organization_id", auth.caller.organizationId)
          .maybeSingle();
        if (!mission) return apiError(404, "not_found", "Mission introuvable.");

        const { data: trajets } = await supabaseAdmin.from("trajets").select("id").eq("mission_id", mission.id);
        const trajetIds = (trajets ?? []).map((t) => t.id);
        if (trajetIds.length === 0) return apiError(404, "not_found", "Aucun document disponible pour cette mission.");

        const { data: attributions } = await supabaseAdmin
          .from("attributions")
          .select("id")
          .in("trajet_id", trajetIds);
        const attributionIds = (attributions ?? []).map((a) => a.id);
        if (attributionIds.length === 0) return apiError(404, "not_found", "Aucun document disponible pour cette mission.");

        const { data: doc } = await supabaseAdmin
          .from("mission_documents")
          .select("url_fichier, nom_fichier, type_document, created_at")
          .in("attribution_id", attributionIds)
          .in("type_document", ["edl_final", "pv_livraison", "edl"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!doc) return apiError(404, "not_found", "Bon de livraison non encore disponible.");

        return apiJson({
          mission_id: mission.id,
          object: "document",
          livemode: true,
          type: "proof_of_delivery",
          filename: doc.nom_fichier,
          url: doc.url_fichier,
          generated_at: doc.created_at,
        });
      },
    },
  },
});
