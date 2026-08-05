/**
 * POST /api/public/v1/quotes/estimate — estimation tarifaire instantanée.
 * Authentification : Bearer sk_test_… (sandbox) ou sk_live_… (production).
 */
import { createFileRoute } from "@tanstack/react-router";
import { apiError, apiJson, apiOptions, readJsonBody, requireApiCaller } from "@/lib/api/api-response.server";

export const Route = createFileRoute("/api/public/v1/quotes/estimate")({
  server: {
    handlers: {
      OPTIONS: () => apiOptions(),
      POST: async ({ request }) => {
        const auth = await requireApiCaller(request);
        if ("response" in auth) return auth.response;
        const { caller } = auth;

        const body = await readJsonBody(request);
        const pickup = typeof body?.["pickup_address"] === "string" ? (body["pickup_address"] as string).trim() : "";
        const delivery = typeof body?.["delivery_address"] === "string" ? (body["delivery_address"] as string).trim() : "";
        const vehicleType = typeof body?.["vehicle_type"] === "string" ? (body["vehicle_type"] as string) : "";
        const pickupDate = typeof body?.["pickup_date"] === "string" ? (body["pickup_date"] as string) : null;

        if (!pickup || !delivery || !vehicleType) {
          return apiError(400, "invalid_request_error", "pickup_address, delivery_address et vehicle_type sont requis.");
        }

        const { quoteB2B } = await import("@/lib/pricing-engine");
        const { toInternalVehicleType } = await import("@/lib/api/api-mappers.server");
        const quote = quoteB2B({
          depart: pickup,
          arrivee: delivery,
          vehicleType: toInternalVehicleType(vehicleType),
          vehicleRunning: true,
          urgency: "planifie",
        });

        const validUntil = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
        const durationHours = quote.distanceKm ? quote.distanceKm / 80 : null;
        const duration = durationHours
          ? `${Math.floor(durationHours)}h${String(Math.round((durationHours % 1) * 60)).padStart(2, "0")}`
          : null;

        if (caller.sandbox) {
          const { sandboxDelay, sandboxId } = await import("@/lib/api/sandbox.server");
          await sandboxDelay();
          return apiJson({
            estimate_id: sandboxId("est", `${pickup}|${delivery}|${vehicleType}`),
            livemode: false,
            distance_km: quote.distanceKm,
            duration_estimate: duration,
            price_ht: quote.priceHt,
            price_ttc: quote.priceTtc,
            currency: "EUR",
            valid_until: validUntil,
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row, error } = await supabaseAdmin
          .from("api_estimates")
          .insert({
            organization_id: caller.organizationId,
            environment: caller.environment,
            pickup_address: pickup,
            delivery_address: delivery,
            vehicle_type: vehicleType,
            pickup_date: pickupDate,
            distance_km: quote.distanceKm,
            price_ht: quote.priceHt,
            price_ttc: quote.priceTtc,
            valid_until: validUntil,
          })
          .select("id, valid_until")
          .single();

        if (error || !row) return apiError(500, "api_error", "Impossible de générer l'estimation.");

        return apiJson({
          estimate_id: row.id,
          livemode: true,
          distance_km: quote.distanceKm,
          duration_estimate: duration,
          price_ht: quote.priceHt,
          price_ttc: quote.priceTtc,
          currency: "EUR",
          valid_until: row.valid_until,
        });
      },
    },
  },
});
