import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhook, type StripeEnv } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Webhook Stripe pour le paiement des factures pro depuis l'espace client.
// Configurer dans Stripe Dashboard : POST /api/public/facture/webhook?env=sandbox|live
export const Route = createFileRoute("/api/public/facture/webhook")({
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
          console.error("[facture/webhook] verification failed", e?.message);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          if (event.type === "checkout.session.completed") {
            const s = event.data.object;
            // Filter to facture sessions only — ignore other types routed to this URL.
            if (s?.metadata?.type !== "facture_pro") {
              return Response.json({ received: true, ignored: "not_facture" });
            }
            const factureId = s?.metadata?.facture_id;
            const sessionId = s?.id;
            const paymentIntentId = typeof s?.payment_intent === "string" ? s.payment_intent : s?.payment_intent?.id;
            const amount = Number(s?.amount_total ?? 0);

            if (factureId) {
              const { data: facture } = await supabaseAdmin
                .from("factures")
                .select("*")
                .eq("id", factureId)
                .maybeSingle();

              await supabaseAdmin
                .from("factures")
                .update({
                  statut: "payee",
                  mode_paiement: "carte",
                  date_paiement: new Date().toISOString().slice(0, 10),
                  paid_at: new Date().toISOString(),
                  stripe_session_id: sessionId,
                  stripe_payment_intent_id: paymentIntentId ?? null,
                  amount_paid_cents: amount,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", factureId);

              // Notify admin (history + push)
              try {
                await supabaseAdmin.rpc("create_admin_notification", {
                  _type: "facture_paiement",
                  _titre: "Facture payée en ligne",
                  _message: `Facture ${facture?.numero ?? factureId} payée · ${(amount / 100).toFixed(2)} €`,
                  _link: `/admin/factures`,
                  _entity_type: "facture",
                  _entity_id: factureId,
                  _metadata: { session_id: sessionId, amount_cents: amount },
                });
              } catch (e) {
                console.error("[facture/webhook] notification error", e);
              }
              try {
                const { sendPushToRole } = await import("@/lib/push/send.server");
                await sendPushToRole("admin", {
                  title: "Paiement reçu 💳",
                  body: `Facture ${facture?.numero ?? factureId} · ${(amount / 100).toFixed(2)} €`,
                  url: `/admin/factures`,
                  tag: `paiement-facture-${factureId}`,
                });
              } catch (e) {
                console.error("[facture/webhook] push error", e);
              }


              // Send confirmation email
              if (facture?.client_email) {
                try {
                  await supabaseAdmin.rpc("enqueue_email", {
                    queue_name: "transactional_emails",
                    payload: {
                      to: facture.client_email,
                      subject: `Paiement reçu — Facture ${facture.numero}`,
                      template: "facture-payee",
                      data: {
                        numero: facture.numero,
                        montant: (amount / 100).toFixed(2),
                        reference: facture.reference_client ?? null,
                      },
                    },
                  });
                } catch (e) {
                  console.error("[facture/webhook] email error", e);
                }
              }
            }
          }
        } catch (e: any) {
          console.error("[facture/webhook] handler error", e);
          return new Response("Handler error", { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
