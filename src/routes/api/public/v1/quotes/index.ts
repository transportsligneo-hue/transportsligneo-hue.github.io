/**
 * POST /api/public/v1/quotes — création d'un devis formel.
 * GET  /api/public/v1/quotes — liste des devis de l'organisation.
 */
import { createFileRoute } from "@tanstack/react-router";
import { apiError, apiJson, apiOptions, readJsonBody, requireApiCaller } from "@/lib/api/api-response.server";

export const Route = createFileRoute("/api/public/v1/quotes/")({
  server: {
    handlers: {
      OPTIONS: () => apiOptions(),
      GET: async ({ request }) => {
        const auth = await requireApiCaller(request);
        if ("response" in auth) return auth.response;
        if (auth.caller.sandbox) {
          const { sandboxDelay } = await import("@/lib/api/sandbox.server");
          await sandboxDelay();
          return apiJson({ object: "list", livemode: false, data: [], has_more: false });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { orgUserIds } = await import("@/lib/api/api-org.server");
        const { quoteToApi } = await import("@/lib/api/api-mappers.server");
        const ids = await orgUserIds(auth.caller.organizationId);
        if (ids.length === 0) return apiJson({ object: "list", livemode: true, data: [], has_more: false });
        const { data } = await supabaseAdmin
          .from("devis")
          .select("id, numero, statut, depart, arrivee, distance_km, total_ht, total_ttc, prix_estime, expires_at, date_souhaitee, created_at")
          .in("user_id", ids)
          .order("created_at", { ascending: false })
          .limit(50);
        return apiJson({
          object: "list",
          livemode: true,
          data: (data ?? []).map(quoteToApi),
          has_more: false,
        });
      },
      POST: async ({ request }) => {
        const auth = await requireApiCaller(request);
        if ("response" in auth) return auth.response;
        const { caller } = auth;

        const body = await readJsonBody(request);
        const str = (k: string) => (typeof body?.[k] === "string" ? (body[k] as string).trim() : "");
        const pickup = str("pickup_address");
        const delivery = str("delivery_address");
        const vehicleType = str("vehicle_type");
        if (!pickup || !delivery || !vehicleType) {
          return apiError(400, "invalid_request_error", "pickup_address, delivery_address et vehicle_type sont requis.");
        }

        const { quoteB2B } = await import("@/lib/pricing-engine");
        const { toInternalVehicleType, quoteToApi } = await import("@/lib/api/api-mappers.server");
        const priced = quoteB2B({
          depart: pickup,
          arrivee: delivery,
          vehicleType: toInternalVehicleType(vehicleType),
          vehicleRunning: true,
          urgency: "planifie",
        });
        const validUntil = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

        if (caller.sandbox) {
          const { sandboxDelay, sandboxId } = await import("@/lib/api/sandbox.server");
          await sandboxDelay();
          return apiJson(
            {
              id: sandboxId("qt", `${pickup}|${delivery}|${vehicleType}`),
              object: "quote",
              livemode: false,
              reference: "DEV-TEST-0001",
              status: "envoye",
              pickup_address: pickup,
              delivery_address: delivery,
              pickup_date: str("pickup_date") || null,
              distance_km: priced.distanceKm,
              price_ht: priced.priceHt,
              price_ttc: priced.priceTtc,
              currency: "EUR",
              valid_until: validUntil,
              created_at: new Date().toISOString(),
            },
            201,
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { orgContact } = await import("@/lib/api/api-org.server");
        const contact = await orgContact(caller.organizationId);
        if (!contact) return apiError(400, "invalid_request_error", "Organisation introuvable ou sans utilisateur rattaché.");

        const customer = (body?.["customer"] ?? {}) as Record<string, unknown>;
        const vehicle = (body?.["vehicle"] ?? {}) as Record<string, unknown>;

        const { data, error } = await supabaseAdmin
          .from("devis")
          .insert({
            user_id: contact.userId,
            nom: (customer["last_name"] as string) || contact.nom,
            prenom: (customer["first_name"] as string) || contact.prenom,
            email: (customer["email"] as string) || contact.email,
            telephone: (customer["phone"] as string) || null,
            depart: pickup,
            arrivee: delivery,
            date_souhaitee: str("pickup_date") || null,
            type_vehicule: vehicleType,
            marque: (vehicle["brand"] as string) ?? null,
            modele: (vehicle["model"] as string) ?? null,
            distance_km: priced.distanceKm,
            prix_estime: priced.priceTtc,
            total_ht: priced.priceHt,
            total_ttc: priced.priceTtc,
            total_tva: Number((priced.priceTtc - priced.priceHt).toFixed(2)),
            statut: "envoye",
            origine: "api",
            expires_at: validUntil,
            message: str("notes") || null,
          })
          .select("id, numero, statut, depart, arrivee, distance_km, total_ht, total_ttc, prix_estime, expires_at, date_souhaitee, created_at")
          .single();

        if (error || !data) return apiError(500, "api_error", "Impossible de créer le devis.");
        return apiJson(quoteToApi(data), 201);
      },
    },
  },
});
