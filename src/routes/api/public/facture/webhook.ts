import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhook, type StripeEnv } from "@/lib/stripe-server";
import { handleFactureWebhookEvent } from "@/lib/stripe-webhooks.server";

// Webhook Stripe pour le paiement des factures pro depuis l'espace client.
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
          await handleFactureWebhookEvent(event);
        } catch (e: any) {
          console.error("[facture/webhook] handler error", e);
          return new Response("Handler error", { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});