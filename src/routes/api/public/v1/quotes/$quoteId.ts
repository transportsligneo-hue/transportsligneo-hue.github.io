/**
 * GET /api/public/v1/quotes/{id} — récupération d'un devis.
 */
import { createFileRoute } from "@tanstack/react-router";
import { apiError, apiJson, apiOptions, requireApiCaller } from "@/lib/api/api-response.server";

export const Route = createFileRoute("/api/public/v1/quotes/$quoteId")({
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
            id: params.quoteId,
            object: "quote",
            livemode: false,
            reference: "DEV-TEST-0001",
            status: "envoye",
            pickup_address: "12 rue de la Paix, 75002 Paris",
            delivery_address: "45 av. Jean Jaurès, 69007 Lyon",
            distance_km: 465,
            price_ht: 285,
            price_ttc: 342,
            currency: "EUR",
            valid_until: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
            created_at: new Date().toISOString(),
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { orgUserIds } = await import("@/lib/api/api-org.server");
        const { quoteToApi } = await import("@/lib/api/api-mappers.server");
        const ids = await orgUserIds(auth.caller.organizationId);
        const { data } = await supabaseAdmin
          .from("devis")
          .select("id, numero, statut, depart, arrivee, distance_km, total_ht, total_ttc, prix_estime, expires_at, date_souhaitee, created_at, user_id")
          .eq("id", params.quoteId)
          .maybeSingle();

        if (!data || !data.user_id || !ids.includes(data.user_id)) {
          return apiError(404, "not_found", "Devis introuvable.");
        }
        return apiJson(quoteToApi(data));
      },
    },
  },
});
