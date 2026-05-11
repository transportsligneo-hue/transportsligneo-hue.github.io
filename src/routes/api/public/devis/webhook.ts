import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhook, type StripeEnv } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Webhook Stripe pour le paiement des devis particuliers/pro.
// Configurer dans Stripe Dashboard : POST /api/public/devis/webhook?env=sandbox|live
export const Route = createFileRoute("/api/public/devis/webhook")({
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
          console.error("[devis/webhook] verification failed", e?.message);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          if (event.type === "checkout.session.completed") {
            const s = event.data.object;
            const devisId = s?.metadata?.devis_id;
            const sessionId = s?.id;
            const paymentIntentId = typeof s?.payment_intent === "string" ? s.payment_intent : s?.payment_intent?.id;
            const amount = Number(s?.amount_total ?? 0);

            if (devisId) {
              await supabaseAdmin
                .from("devis")
                .update({
                  statut: "accepte",
                  paid_at: new Date().toISOString(),
                  stripe_session_id: sessionId,
                  stripe_payment_intent_id: paymentIntentId ?? null,
                  amount_paid_cents: amount,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", devisId);

              // Notify admin
              try {
                await supabaseAdmin.rpc("create_admin_notification", {
                  _type: "b2b_paiement",
                  _titre: "Paiement devis confirmé",
                  _message: `Devis ${s?.metadata?.devis_numero ?? devisId} payé`,
                  _link: `/admin/devis/${devisId}`,
                  _entity_type: "devis",
                  _entity_id: devisId,
                  _metadata: { session_id: sessionId, amount_cents: amount },
                });
              } catch (e) {
                console.error("[devis/webhook] notification error", e);
              }
            }
          } else if (event.type === "payment_intent.payment_failed") {
            const pi = event.data.object;
            const devisId = pi?.metadata?.devis_id;
            if (devisId) {
              await supabaseAdmin
                .from("devis")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", devisId);
            }
          }
        } catch (e: any) {
          console.error("[devis/webhook] handler error", e);
          return new Response("Handler error", { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
