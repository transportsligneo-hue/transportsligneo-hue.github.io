import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhook, type StripeEnv } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailServer, getAdminNotificationEmail } from "@/server/email-send";

const CONVERSION_THRESHOLD = 3; // paid B2B requests → suggest flotte conversion

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

              // Re-fetch full request + company
              const { data: req2 } = await supabaseAdmin
                .from("b2b_transport_requests")
                .select("id, numero, pickup_address, dropoff_address, scheduled_date, scheduled_time, vehicle_type, urgency, estimated_price_ttc, company_id")
                .eq("id", requestId)
                .maybeSingle();

              const { data: company } = req2?.company_id
                ? await supabaseAdmin.from("companies")
                    .select("name, contact_name, contact_email, contact_phone")
                    .eq("id", req2.company_id).maybeSingle()
                : { data: null as any };

              await supabaseAdmin.from("b2b_actions_history").insert({
                action_type: "payment_succeeded",
                related_id: requestId,
                related_type: "transport_request",
                company_id: req2?.company_id ?? null,
                metadata: { session_id: sessionId, payment_intent_id: paymentIntentId },
              });

              // === Notification admin: paiement B2B ===
              const adminEmail = await getAdminNotificationEmail();
              await sendTransactionalEmailServer({
                templateName: "b2b-paiement-admin",
                recipientEmail: adminEmail,
                idempotencyKey: `b2b-paid-${requestId}`,
                templateData: {
                  numero: req2?.numero,
                  pickup: req2?.pickup_address,
                  dropoff: req2?.dropoff_address,
                  scheduledDate: req2?.scheduled_date,
                  scheduledTime: req2?.scheduled_time,
                  vehicleType: req2?.vehicle_type,
                  urgency: req2?.urgency,
                  prixTtc: req2?.estimated_price_ttc,
                  companyName: company?.name,
                  contactName: company?.contact_name,
                  contactEmail: company?.contact_email,
                  contactPhone: company?.contact_phone,
                },
              });

              // === Détection auto: conversion ponctuel → flotte ===
              if (req2?.company_id) {
                const { data: paidRows } = await supabaseAdmin
                  .from("b2b_transport_requests")
                  .select("estimated_price_ttc")
                  .eq("company_id", req2.company_id)
                  .eq("payment_status", "paid");

                const paidCount = paidRows?.length ?? 0;
                if (paidCount >= CONVERSION_THRESHOLD) {
                  // Already notified ?
                  const { data: alreadyNotified } = await supabaseAdmin
                    .from("b2b_actions_history")
                    .select("id")
                    .eq("company_id", req2.company_id)
                    .eq("action_type", "conversion_suggested")
                    .limit(1).maybeSingle();

                  if (!alreadyNotified) {
                    const totalAmount = paidRows!.reduce(
                      (s, r) => s + (Number(r.estimated_price_ttc) || 0), 0
                    );
                    await sendTransactionalEmailServer({
                      templateName: "b2b-conversion-suggestion-admin",
                      recipientEmail: adminEmail,
                      idempotencyKey: `b2b-conversion-${req2.company_id}`,
                      templateData: {
                        companyName: company?.name,
                        contactName: company?.contact_name,
                        contactEmail: company?.contact_email,
                        contactPhone: company?.contact_phone,
                        paidCount,
                        totalAmount,
                      },
                    });
                    await supabaseAdmin.from("b2b_actions_history").insert({
                      action_type: "conversion_suggested",
                      related_id: req2.company_id,
                      related_type: "company",
                      company_id: req2.company_id,
                      metadata: { paid_count: paidCount, total_amount: totalAmount },
                    });
                  }
                }
              }
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
