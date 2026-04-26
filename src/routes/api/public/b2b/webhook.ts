import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhook, type StripeEnv } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public endpoint: Stripe webhook. Signature verification protects this route.
// Configure both sandbox and live Stripe webhooks to point here with `?env=sandbox|live`.
export const Route = createFileRoute("/api/public/b2b/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const rawEnv = url.searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" }, { status: 200 });
        }
        const env: StripeEnv = rawEnv;

        let event: { type: string; data: { object: any } };
        try {
          event = await verifyStripeWebhook(request, env);
        } catch (e: any) {
          console.error("[b2b/webhook] verification failed", e?.message);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          if (event.type === "checkout.session.completed") {
            const s = event.data.object;
            const requestId = s?.metadata?.b2b_request_id;
            const sessionId = s?.id;
            const paymentIntentId = typeof s?.payment_intent === "string" ? s.payment_intent : s?.payment_intent?.id;

            if (requestId) {
              await supabaseAdmin
                .from("b2b_transport_requests")
                .update({
                  payment_status: "paid",
                  stripe_session_id: sessionId,
                  stripe_payment_intent_id: paymentIntentId ?? null,
                  operational_status: "a_dispatcher",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", requestId);

              // Historique
              const { data: req2 } = await supabaseAdmin
                .from("b2b_transport_requests")
                .select("company_id")
                .eq("id", requestId)
                .maybeSingle();

              await supabaseAdmin.from("b2b_actions_history").insert({
                action_type: "payment_succeeded",
                related_id: requestId,
                related_type: "transport_request",
                company_id: req2?.company_id ?? null,
                metadata: { session_id: sessionId, payment_intent_id: paymentIntentId },
              });
            }
          } else if (event.type === "payment_intent.payment_failed") {
            const pi = event.data.object;
            const requestId = pi?.metadata?.b2b_request_id;
            if (requestId) {
              await supabaseAdmin
                .from("b2b_transport_requests")
                .update({ payment_status: "failed", updated_at: new Date().toISOString() })
                .eq("id", requestId);
            }
          } else {
            console.log("[b2b/webhook] unhandled", event.type);
          }
        } catch (e: any) {
          console.error("[b2b/webhook] handler error", e);
          return new Response("Handler error", { status: 500 });
        }

        return Response.json({ received: true });
      },
    },
  },
});
