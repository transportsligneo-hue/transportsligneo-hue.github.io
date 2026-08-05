/**
 * POST /api/public/v1/missions — création d'une mission à partir d'un devis accepté.
 * GET  /api/public/v1/missions — liste paginée des missions du client (filtres statut/date).
 */
import { createFileRoute } from "@tanstack/react-router";
import { apiError, apiJson, apiOptions, readJsonBody, requireApiCaller } from "@/lib/api/api-response.server";

const MISSION_COLS =
  "id, numero, statut, ville_depart, ville_arrivee, immatriculation, marque, modele, prix_total, date_prise_en_charge, devis_id, created_at, options, organization_id";

export const Route = createFileRoute("/api/public/v1/missions/")({
  server: {
    handlers: {
      OPTIONS: () => apiOptions(),

      GET: async ({ request }) => {
        const auth = await requireApiCaller(request);
        if ("response" in auth) return auth.response;
        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1), 100);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

        if (auth.caller.sandbox) {
          const { sandboxDelay, sandboxMission, sandboxId } = await import("@/lib/api/sandbox.server");
          await sandboxDelay();
          return apiJson({
            object: "list",
            livemode: false,
            data: [sandboxMission(sandboxId("mis", "sandbox-1")), sandboxMission(sandboxId("mis", "sandbox-2"))],
            has_more: false,
            limit,
            offset,
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { missionToApi, toApiStatus } = await import("@/lib/api/api-mappers.server");

        let query = supabaseAdmin
          .from("missions")
          .select(MISSION_COLS, { count: "exact" })
          .eq("organization_id", auth.caller.organizationId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        const from = url.searchParams.get("created_after");
        const to = url.searchParams.get("created_before");
        if (from) query = query.gte("created_at", from);
        if (to) query = query.lte("created_at", to);

        const { data, count } = await query;
        const status = url.searchParams.get("status");
        const rows = (data ?? []).map(missionToApi).filter((m) => !status || toApiStatus(m.status) === status || m.status === status);

        return apiJson({
          object: "list",
          livemode: true,
          data: rows,
          has_more: (count ?? 0) > offset + limit,
          total: count ?? rows.length,
          limit,
          offset,
        });
      },

      POST: async ({ request }) => {
        const auth = await requireApiCaller(request);
        if ("response" in auth) return auth.response;
        const { caller } = auth;

        const body = await readJsonBody(request);
        const quoteId = typeof body?.["quote_id"] === "string" ? (body["quote_id"] as string) : "";
        if (!quoteId) return apiError(400, "invalid_request_error", "quote_id est requis.");

        if (caller.sandbox) {
          const { sandboxDelay, sandboxMission, sandboxId } = await import("@/lib/api/sandbox.server");
          await sandboxDelay();
          return apiJson(
            sandboxMission(sandboxId("mis", quoteId), { status: "pending", quote_id: quoteId }),
            201,
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { orgUserIds } = await import("@/lib/api/api-org.server");
        const { missionToApi } = await import("@/lib/api/api-mappers.server");

        const ids = await orgUserIds(caller.organizationId);
        const { data: devis } = await supabaseAdmin
          .from("devis")
          .select("*")
          .eq("id", quoteId)
          .maybeSingle();

        if (!devis || !devis.user_id || !ids.includes(devis.user_id)) {
          return apiError(404, "not_found", "Devis introuvable pour cette organisation.");
        }
        if (devis.mission_id) {
          return apiError(409, "invalid_request_error", "Ce devis a déjà été converti en mission.");
        }

        const vehicle = (body?.["vehicle"] ?? {}) as Record<string, unknown>;
        const contact = (body?.["contact"] ?? {}) as Record<string, unknown>;
        const pickupDate =
          (typeof body?.["pickup_date"] === "string" ? (body["pickup_date"] as string) : null) ??
          devis.date_souhaitee ??
          new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

        const { data: mission, error } = await supabaseAdmin
          .from("missions")
          .insert({
            user_id: devis.user_id,
            organization_id: caller.organizationId,
            devis_id: devis.id,
            nom: devis.nom,
            prenom: devis.prenom,
            email: devis.email,
            telephone: devis.telephone,
            ville_depart: devis.depart,
            ville_arrivee: devis.arrivee,
            date_prise_en_charge: pickupDate,
            type_trajet: "aller_simple",
            marque: (vehicle["brand"] as string) ?? devis.marque,
            modele: (vehicle["model"] as string) ?? devis.modele,
            immatriculation: (vehicle["plate"] as string) ?? null,
            vin: (vehicle["vin"] as string) ?? null,
            contact_depart_nom: (contact["pickup_name"] as string) ?? null,
            contact_depart_tel: (contact["pickup_phone"] as string) ?? null,
            contact_arrivee_nom: (contact["delivery_name"] as string) ?? null,
            contact_arrivee_tel: (contact["delivery_phone"] as string) ?? null,
            prix_total: devis.total_ttc ?? devis.prix_estime,
            statut: "en_attente",
            options: {
              source: "api",
              po_number: typeof body?.["po_number"] === "string" ? body["po_number"] : null,
              webhook_url: typeof body?.["webhook_url"] === "string" ? body["webhook_url"] : null,
            },
          })
          .select(MISSION_COLS)
          .single();

        if (error || !mission) return apiError(500, "api_error", "Impossible de créer la mission.");

        await supabaseAdmin
          .from("devis")
          .update({ mission_id: mission.id, statut: "accepte", converted_at: new Date().toISOString() })
          .eq("id", devis.id);

        return apiJson(missionToApi(mission), 201);
      },
    },
  },
});
