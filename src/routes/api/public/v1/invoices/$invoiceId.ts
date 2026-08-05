/**
 * GET /api/public/v1/invoices/{id} — facture PDF.
 */
import { createFileRoute } from "@tanstack/react-router";
import { apiError, apiJson, apiOptions, requireApiCaller } from "@/lib/api/api-response.server";

export const Route = createFileRoute("/api/public/v1/invoices/$invoiceId")({
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
            id: params.invoiceId,
            object: "invoice",
            livemode: false,
            number: "FA-TEST-0001",
            status: "paid",
            amount_ht: 285,
            amount_ttc: 342,
            currency: "EUR",
            url: "https://api-sandbox.transportsligneo.fr/v1/documents/inv_test_sample.pdf",
            issued_at: new Date().toISOString(),
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: invoice } = await supabaseAdmin
          .from("factures")
          .select("id, numero, statut, prix_ht, prix_ttc, pdf_url, date_facture, mission_id")
          .eq("id", params.invoiceId)
          .maybeSingle();
        if (!invoice) return apiError(404, "not_found", "Facture introuvable.");

        if (!invoice.mission_id) return apiError(404, "not_found", "Facture introuvable.");
        const { data: mission } = await supabaseAdmin
          .from("missions")
          .select("id")
          .eq("id", invoice.mission_id)
          .eq("organization_id", auth.caller.organizationId)
          .maybeSingle();
        if (!mission) return apiError(404, "not_found", "Facture introuvable.");

        return apiJson({
          id: invoice.id,
          object: "invoice",
          livemode: true,
          number: invoice.numero,
          status: invoice.statut,
          mission_id: invoice.mission_id,
          amount_ht: invoice.prix_ht,
          amount_ttc: invoice.prix_ttc,
          currency: "EUR",
          url: invoice.pdf_url,
          issued_at: invoice.date_facture,
        });
      },
    },
  },
});
