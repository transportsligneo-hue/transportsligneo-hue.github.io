import { createFileRoute } from "@tanstack/react-router";
import { createStripeClient, type StripeEnv } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/b2b/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const { requestId, returnUrl, environment } = body ?? {};

        if (!requestId || !UUID_RE.test(String(requestId))) {
          return Response.json({ error: "Invalid requestId" }, { status: 400 });
        }
        if (!returnUrl || typeof returnUrl !== "string") {
          return Response.json({ error: "Missing returnUrl" }, { status: 400 });
        }
        const env: StripeEnv = environment === "live" ? "live" : "sandbox";

        // Charger la demande côté serveur (source de vérité prix)
        const { data: req2, error } = await supabaseAdmin
          .from("b2b_transport_requests")
          .select("id, numero, pickup_address, dropoff_address, estimated_price_ttc, payment_status, company_id")
          .eq("id", requestId)
          .maybeSingle();

        if (error || !req2) {
          return Response.json({ error: "Demande introuvable" }, { status: 404 });
        }
        if (req2.payment_status === "paid") {
          return Response.json({ error: "Demande déjà payée" }, { status: 409 });
        }
        const ttc = Number(req2.estimated_price_ttc);
        if (!ttc || ttc < 1) {
          return Response.json({ error: "Montant invalide" }, { status: 400 });
        }

        // Email de contact via la company
        let customerEmail: string | undefined;
        if (req2.company_id) {
          const { data: company } = await supabaseAdmin
            .from("companies")
            .select("contact_email")
            .eq("id", req2.company_id)
            .maybeSingle();
          customerEmail = company?.contact_email ?? undefined;
        }

        try {
          const stripe = createStripeClient(env);
          const session = await stripe.checkout.sessions.create({
            line_items: [{
              price_data: {
                currency: "eur",
                product_data: {
                  name: `Transport B2B ${req2.numero}`,
                  description: `${req2.pickup_address} → ${req2.dropoff_address}`,
                },
                unit_amount: Math.round(ttc * 100),
              },
              quantity: 1,
            }],
            mode: "payment",
            ui_mode: "embedded",
            return_url: returnUrl,
            ...(customerEmail && { customer_email: customerEmail }),
            metadata: {
              b2b_request_id: req2.id,
              b2b_numero: req2.numero,
            },
            payment_intent_data: {
              metadata: {
                b2b_request_id: req2.id,
                b2b_numero: req2.numero,
              },
            },
          });

          // Persister la session sur la demande
          await supabaseAdmin
            .from("b2b_transport_requests")
            .update({ stripe_session_id: session.id })
            .eq("id", req2.id);

          return Response.json({ clientSecret: session.client_secret });
        } catch (e: any) {
          console.error("[b2b/checkout] Stripe error", e);
          return Response.json({ error: e?.message ?? "Stripe error" }, { status: 500 });
        }
      },
    },
  },
});
