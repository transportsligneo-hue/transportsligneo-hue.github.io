import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhook, type StripeEnv } from "@/lib/stripe-server";
import {
  handleDevisWebhookEvent,
  handleFactureWebhookEvent,
  handleB2BWebhookEvent,
} from "@/lib/stripe-webhooks.server";

// Webhook Stripe unifié — point d'entrée unique pour la livraison des
// événements de paiement (devis, factures pro, B2B ponctuel). Les endpoints
// Stripe sandbox & live pointent ici avec ?env=sandbox|live ; la signature
// est vérifiée, puis l'événement est routé vers le handler de l'entité via
// les metadata posées sur la session / le payment intent au checkout.
export const Route = createFileRoute("/api/public/stripe-webhook")({
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
          console.error("[stripe-webhook] verification failed", e?.message);
          return new Response("Invalid signature", { status: 400 });
        }

        const meta = event?.data?.object?.metadata ?? {};
        try {
          if (meta?.devis_id) {
            await handleDevisWebhookEvent(event);
          } else if (meta?.facture_id || meta?.type === "facture_pro") {
            await handleFactureWebhookEvent(event);
          } else if (meta?.b2b_request_id) {
            await handleB2BWebhookEvent(event);
          } else {
            console.log("[stripe-webhook] no routing metadata for", event.type);
          }
        } catch (e: any) {
          console.error("[stripe-webhook] handler error", e);
          return new Response("Handler error", { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});